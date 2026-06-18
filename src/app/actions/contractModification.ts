'use server';

import { prisma } from '@/lib/prisma';
import { findOrUpdateSupplyPointByCups } from '@/lib/supplyPointHelper';
import { revalidatePath } from 'next/cache';
import { generateModificationDocxBuffer } from '@/lib/docGenerator';

export async function createContractModificationAction(
  oldContractId: string,
  modificationType: string,
  formData: any
) {
  try {
    const oldContract = await prisma.contract.findUnique({
      where: { id: oldContractId },
      include: { client: true, supplyPoint: true, brand: true, product: true }
    });

    if (!oldContract) throw new Error("Contrato original no encontrado");

    const brandIdToUse = oldContract.brandId;
    if (!brandIdToUse) throw new Error("El contrato no tiene una comercializadora (brandId) asociada.");

    const cups = oldContract.supplyPoint.cups;
    let newClientId = oldContract.clientId;
    let newSupplyPointId = oldContract.supplyPointId;
    
    const isSubrogation = modificationType === 'SUBROGACION';
    const isTecnica = modificationType === 'MODIFICACION_TECNICA';

    let nifFinal = oldContract.client.vatNumber;
    let nombreFinal = oldContract.client.businessName || '';
    let ibanFinal = oldContract.supplyPoint.iban || '';
    let apellido1Final = oldContract.client.lastName || '';
    let apellido2Final = oldContract.client.lastName2 || '';
    let repNameFinal = oldContract.client.representativeName || '';
    let repVatFinal = oldContract.client.representativeVat || '';

    if (isSubrogation) {
      const vatClean = formData.cif.trim().toUpperCase();
      nifFinal = vatClean;
      
      const isFisica = formData.tipoPersona === 'FISICA';
      nombreFinal = isFisica ? formData.nombreTitular : formData.razonSocial;
      apellido1Final = isFisica ? formData.apellido1 : '';
      apellido2Final = isFisica ? formData.apellido2 : '';
      repNameFinal = !isFisica ? `${formData.nombreApoderado} ${formData.apellidosApoderado}`.trim() : '';
      repVatFinal = !isFisica ? formData.nifApoderado : '';
      
      const fullBusinessName = isFisica ? `${nombreFinal} ${apellido1Final} ${apellido2Final}`.trim() : nombreFinal;
      
      ibanFinal = formData.iban;

      // 1. Find or create Client
      let newClient = await prisma.client.findFirst({
        where: { vatNumber: vatClean, brandId: brandIdToUse }
      });

      if (!newClient) {
        newClient = await prisma.client.create({
          data: {
            clientType: isFisica ? 'FÍSICA' : 'JURÍDICA',
            vatNumber: vatClean,
            businessName: fullBusinessName,
            firstName: isFisica ? nombreFinal : null,
            lastName: isFisica ? apellido1Final : null,
            lastName2: isFisica ? apellido2Final : null,
            representativeName: repNameFinal,
            representativeVat: repVatFinal,
            contactPhone: formData.telefono,
            contactEmail: formData.email,
            paperInvoice: formData.facturaPapel === 'SI',
            brandId: brandIdToUse
          }
        });
      } else {
        await prisma.client.update({
          where: { id: newClient.id },
          data: {
            contactPhone: formData.telefono || newClient.contactPhone,
            contactEmail: formData.email || newClient.contactEmail,
            paperInvoice: formData.facturaPapel === 'SI',
            firstName: isFisica ? nombreFinal : newClient.firstName,
            lastName: isFisica ? apellido1Final : newClient.lastName,
            lastName2: isFisica ? apellido2Final : newClient.lastName2,
            businessName: fullBusinessName,
            representativeName: repNameFinal || newClient.representativeName,
            representativeVat: repVatFinal || newClient.representativeVat
          }
        });
      }
      newClientId = newClient.id;

      // 2. Find or create SupplyPoint for the NEW client with SAME cups
      const spData = {
        address: `${formData.tipoVia} ${formData.calle} ${formData.numero} ${formData.adicional}`.trim(),
        postalCode: formData.cp,
        city: formData.poblacion,
        province: formData.provincia,
        iban: formData.iban,
        tariff: oldContract.supplyPoint.tariff || "2.0TD"
      };

      const supplyPoint = await findOrUpdateSupplyPointByCups(prisma, cups, newClientId, spData);
      if (!supplyPoint) throw new Error("Error al generar o buscar el Punto de Suministro.");
      newSupplyPointId = supplyPoint.id;
    }

    // Clone contract data
    const oldContractDataObj: any = (oldContract.airtableData as any) || {};
    const newContractData = { ...oldContractDataObj };

    if (isSubrogation) {
      newContractData.nif = nifFinal;
      newContractData.nombre = nombreFinal;
      newContractData.iban = ibanFinal;
    } else if (isTecnica) {
      newContractData.tarifa = formData.tarifa;
      newContractData.p1c = formData.p1c;
      newContractData.p2c = formData.p2c;
      newContractData.p3c = formData.p3c;
      newContractData.p4c = formData.p4c;
      newContractData.p5c = formData.p5c;
      newContractData.p6c = formData.p6c;
    }

    const nextVersion = (oldContract.version || 1) + 1;
    const baseCode = (oldContract.contractCode || "").split('-V')[0];
    const newCode = `${baseCode}-V${nextVersion}`;

    // Create the new contract version
    const newContract = await prisma.contract.create({
      data: {
        contractCode: newCode,
        version: nextVersion,
        clientId: newClientId,
        supplyPointId: newSupplyPointId,
        productId: oldContract.productId,
        brandId: oldContract.brandId,
        userId: oldContract.userId, 
        previousContractId: oldContract.id,
        tipo: 'M1',
        tipoC2: isSubrogation ? 'S' : 'N',
        status: 'BORRADOR',
        airtableData: newContractData,
        p1e: oldContract.p1e, p2e: oldContract.p2e, p3e: oldContract.p3e,
        p4e: oldContract.p4e, p5e: oldContract.p5e, p6e: oldContract.p6e,
        p1p: oldContract.p1p, p2p: oldContract.p2p, p3p: oldContract.p3p,
        p4p: oldContract.p4p, p5p: oldContract.p5p, p6p: oldContract.p6p,
        fee: oldContract.fee,
        commissionBase: oldContract.commissionBase,
        svaConcept: isSubrogation ? formData.servicio : oldContract.svaConcept,
        filePdfSigned: oldContract.filePdfSigned,
        fileAnexoFirmado: oldContract.fileAnexoFirmado,
      }
    });

    // Generate PDF Mapping
    const titularDir = isSubrogation 
      ? `${formData.tipoVia} ${formData.calle} ${formData.numero}`
      : `${oldContract.client.billingAddress || oldContractDataObj.direccionTitular || ''}`;
      
    const templateData = {
      nombretit: nombreFinal,
      "1apetit": apellido1Final,
      "2apetit": apellido2Final,
      nif: nifFinal,
      cnae: oldContractDataObj.cnae || "",
      direcciontitular: titularDir,
      cptit: isSubrogation ? formData.cp : (oldContract.client.billingPostalCode || ""),
      loctit: isSubrogation ? formData.poblacion : (oldContract.client.billingCity || ""),
      provtit: isSubrogation ? formData.provincia : (oldContract.client.billingProvince || ""),
      mailtitular: isSubrogation ? formData.email : (oldContract.client.contactEmail || ""),
      tlftitular: isSubrogation ? formData.telefono : (oldContract.client.contactPhone || ""),
      mvtitular: isSubrogation ? formData.telefono : (oldContract.client.contactPhone || ""),
      nombrerep: repNameFinal || oldContractDataObj.contactoNombre || "",
      nifrep: repVatFinal || oldContractDataObj.contactoNif || "",
      cups: cups,
      direccionPS: oldContract.supplyPoint.address || "",
      cpPS: oldContract.supplyPoint.postalCode || "",
      localidadPS: oldContract.supplyPoint.city || "",
      provPS: oldContract.supplyPoint.province || "",
      iban: ibanFinal,
      // For Tech Mod
      tarifa: isTecnica ? formData.tarifa : (oldContractDataObj.tarifa || ""),
      p1c: isTecnica ? formData.p1c : (oldContractDataObj.p1c || ""),
      p2c: isTecnica ? formData.p2c : (oldContractDataObj.p2c || ""),
      p3c: isTecnica ? formData.p3c : (oldContractDataObj.p3c || ""),
      p4c: isTecnica ? formData.p4c : (oldContractDataObj.p4c || ""),
      p5c: isTecnica ? formData.p5c : (oldContractDataObj.p5c || ""),
      p6c: isTecnica ? formData.p6c : (oldContractDataObj.p6c || ""),
    };

    const docxBuffer = await generateModificationDocxBuffer(templateData, isTecnica);

    const { convertDocxToPdfViaDocuSign } = await import('@/lib/docusignConverter');
    const pdfBuffer = await convertDocxToPdfViaDocuSign(docxBuffer);

    const { uploadFileToR2 } = await import('@/lib/r2');
    const fileName = `MOD_${newContract.id}.pdf`;
    const uploadedUrl = await uploadFileToR2(`contracts/drafts/${fileName}`, pdfBuffer, 'application/pdf');

    await prisma.contract.update({
      where: { id: newContract.id },
      data: { pdfUrl: uploadedUrl }
    });

    revalidatePath(`/contratos/${oldContractId}`);
    return { success: true, newContractId: newContract.id };

  } catch (error: any) {
    console.error("Error en createContractModificationAction:", error);
    return { error: error.message };
  }
}
