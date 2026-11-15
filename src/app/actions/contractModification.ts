'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { findOrUpdateSupplyPointByCups } from '@/lib/supplyPointHelper';
import { normalizeSpanishPostalCode } from '@/lib/postalCode';
import { revalidatePath } from 'next/cache';
import { generateModificationDocxBuffer } from '@/lib/docGenerator';

export async function createContractModificationAction(
  oldContractId: string,
  modificationType: string,
  formData: any
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { error: 'No autorizado' };
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { channel: true },
    });
    if (!dbUser || dbUser.isActive === false) {
      return { error: 'Usuario no autorizado o inactivo.' };
    }

    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    const oldContract = await prisma.contract.findFirst({
      where: { id: oldContractId, ...visibilityFilter },
      include: { client: true, supplyPoint: true, brand: true, product: true }
    });

    if (!oldContract) throw new Error("Contrato original no encontrado o sin permisos");

    const isAdminOrBackoffice = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(dbUser.role);
    if (!isAdminOrBackoffice) {
      if (dbUser.role === 'CANAL' && oldContract.expectedEndDate) {
        const maxDays = dbUser.channel?.maxRenewalDays ?? 45;
        const diffDays = (new Date(oldContract.expectedEndDate).getTime() - Date.now()) / (1000 * 3600 * 24);
        if (diffDays < 0 || diffDays > maxDays) {
          return { error: 'Solo puedes solicitar modificaciones dentro del periodo de renovación autorizado.' };
        }
      } else {
        return { error: 'No tienes permisos para solicitar modificaciones sobre este contrato.' };
      }
    }

    const brandIdToUse = oldContract.brandId;
    if (!brandIdToUse) throw new Error("El contrato no tiene una comercializadora (brandId) asociada.");

    const cups = oldContract.supplyPoint.cups;
    let newClientId = oldContract.clientId;
    let newSupplyPointId = oldContract.supplyPointId;
    
    const isSubrogation = modificationType === 'SUBROGACION';
    const isTecnica = modificationType === 'MODIFICACION_TECNICA';
    const isAutoconsumo = modificationType === 'ACTIVAR_AUTOCONSUMO';

    let nifFinal = oldContract.client.vatNumber;
    let nombreFinal = oldContract.client.businessName || '';
    let ibanFinal = oldContract.supplyPoint.iban || '';
    let apellido1Final = oldContract.client.lastName || '';
    let apellido2Final = oldContract.client.lastName2 || '';
    const cAirtable: any = oldContract.airtableData || {};
    
    let repNameFinal = oldContract.client.representativeName;
    let repVatFinal = oldContract.client.representativeVat;

    const isCompanyClient = oldContract.client.clientType === 'Jurídica' || oldContract.client.clientType === 'JURÍDICA' || (oldContract.client.businessName && (oldContract.client.businessName.toLowerCase().includes('s.l') || oldContract.client.businessName.toLowerCase().includes('s.a')));

    if (isCompanyClient) {
      if (!repNameFinal) {
        repNameFinal = cAirtable['Nombre Contacto'] 
          ? `${cAirtable['Nombre Contacto']} ${cAirtable['Apellidos Contacto'] || ''}`.trim()
          : (cAirtable['Apoderado / Rep. Legal'] || cAirtable['NOMBRE Y APELLIDOS'] || cAirtable['Nombre Representante'] || cAirtable['Apoderado'] || '');
      }
      if (!repVatFinal) {
        repVatFinal = cAirtable['NIF Contacto'] || cAirtable['NIF APODERADO'] || cAirtable['NIF Apoderado'] || '';
      }
    }

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
            brandId: brandIdToUse,
            cnae: oldContract.client.cnae || oldContract.supplyPoint.cnae,
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
            representativeVat: repVatFinal || newClient.representativeVat,
            cnae: newClient.cnae || oldContract.client.cnae || oldContract.supplyPoint.cnae,
          }
        });
      }
      newClientId = newClient.id;

      // 2. Find or create SupplyPoint for the NEW client with SAME cups
      const normalizedCp = normalizeSpanishPostalCode(formData.cp, oldContract.supplyPoint.postalCode || '00000');
      const spData = {
        address: `${formData.tipoVia} ${formData.calle} ${formData.numero} ${formData.adicional}`.trim(),
        streetType: formData.tipoVia,
        street: formData.calle,
        streetNumber: formData.numero,
        addressAddition: formData.adicional,
        postalCode: normalizedCp,
        city: formData.poblacion,
        province: formData.provincia,
        iban: formData.iban,
        tariff: oldContract.supplyPoint.tariff || "2.0TD",
        distributor: oldContract.supplyPoint.distributor,
        distributorName: oldContract.supplyPoint.distributorName,
        annualConsumption: oldContract.supplyPoint.annualConsumption,
        cnae: oldContract.supplyPoint.cnae || oldContract.client.cnae,
        p1c: oldContract.supplyPoint.p1c,
        p2c: oldContract.supplyPoint.p2c,
        p3c: oldContract.supplyPoint.p3c,
        p4c: oldContract.supplyPoint.p4c,
        p5c: oldContract.supplyPoint.p5c,
        p6c: oldContract.supplyPoint.p6c,
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
      newContractData.tipoSolicitudAdministrativa = 'S';
    } else if (isTecnica) {
      newContractData.tarifa = formData.tarifa;
      newContractData.Tarifa = formData.tarifa;
      newContractData['Código Tarifa'] = [formData.tarifa];
      newContractData.p1c = formData.p1c;
      newContractData.p2c = formData.p2c;
      newContractData.p3c = formData.p3c;
      newContractData.p4c = formData.p4c;
      newContractData.p5c = formData.p5c;
      newContractData.p6c = formData.p6c;
    } else if (isAutoconsumo) {
      newContractData.cau = formData.cau;
      newContractData.selfConsumptionType = formData.selfConsumptionType;
      newContractData.cauSubtype = formData.cauSubtype;
      newContractData.cauCollective = formData.cauCollective;
      newContractData.cil = formData.cil;
      newContractData.generatorTechnology = formData.generatorTechnology;
      newContractData.installedPowerGen = formData.installedPowerGen;
      newContractData.installationType = formData.installationType;
      newContractData.meteringScheme = formData.meteringScheme;
      newContractData.isAutoconsumoModification = true;
    }

    const newCode = oldContract.contractCode;
    const maxVersionRow = newCode
      ? await prisma.contract.findFirst({
          where: { contractCode: newCode, brandId: oldContract.brandId },
          orderBy: { version: 'desc' },
          select: { version: true },
        })
      : null;
    const nextVersion = (maxVersionRow?.version ?? oldContract.version ?? 0) + 1;

    // Evitar colisión @unique en previousContractId si ya existe otra versión colgando de oldContract.id
    const existingPrevLink = await prisma.contract.findUnique({
      where: { previousContractId: oldContract.id },
      select: { id: true },
    });
    const safePreviousContractId = existingPrevLink ? null : oldContract.id;

    // 1. Generar DOCX y convertir a PDF vía DocuSign ANTES de crear el contrato en BD
    //    para evitar contratos huérfanos o bloqueos @unique si falla la conversión PDF.
    const titularDir = isSubrogation 
      ? `${formData.tipoVia} ${formData.calle} ${formData.numero}`
      : `${oldContract.client.billingAddress || oldContractDataObj.direccionTitular || ''}`;
      
    const templateData = {
      contrato: newCode || "",
      numcontrato: newCode || "",
      fecha: new Date().toLocaleDateString('es-ES'),
      fechafirma: new Date().toLocaleDateString('es-ES'),
      nombretit: nombreFinal,
      "1apetit": apellido1Final,
      "2apetit": apellido2Final,
      nif: nifFinal,
      cnae: oldContract.supplyPoint.cnae || oldContract.client.cnae || oldContractDataObj.cnae || "",
      direcciontitular: titularDir,
      cptit: isSubrogation ? normalizeSpanishPostalCode(formData.cp, '') : (oldContract.client.billingPostalCode || oldContractDataObj.cpTitular || ""),
      loctit: isSubrogation ? formData.poblacion : (oldContract.client.billingCity || oldContractDataObj.poblacionTitular || ""),
      provtit: isSubrogation ? formData.provincia : (oldContract.client.billingProvince || oldContractDataObj.provinciaTitular || ""),
      mailtitular: isSubrogation ? formData.email : (oldContract.client.contactEmail || oldContractDataObj.emailTitular || ""),
      tlftitular: isSubrogation ? formData.telefono : (oldContract.client.contactPhone || oldContractDataObj.telefonoTitular || ""),
      mvtitular: isSubrogation ? formData.telefono : (oldContract.client.contactPhone || oldContractDataObj.movilTitular || ""),
      nombrerep: repNameFinal || oldContractDataObj.contactoNombre || "",
      nifrep: repVatFinal || oldContractDataObj.contactoNif || "",
      cups: cups,
      direccionPS: oldContract.supplyPoint.address || "",
      cpPS: oldContract.supplyPoint.postalCode || "",
      localidadPS: oldContract.supplyPoint.city || "",
      provPS: oldContract.supplyPoint.province || "",
      iban: ibanFinal,
      // For Tech Mod
      tarifa: isTecnica ? formData.tarifa : (oldContract.supplyPoint.tariff || oldContractDataObj.tarifa || ""),
      p1c: isTecnica ? formData.p1c : (oldContract.p1c || oldContractDataObj.p1c || ""),
      p2c: isTecnica ? formData.p2c : (oldContract.p2c || oldContractDataObj.p2c || ""),
      p3c: isTecnica ? formData.p3c : (oldContract.p3c || oldContractDataObj.p3c || ""),
      p4c: isTecnica ? formData.p4c : (oldContract.p4c || oldContractDataObj.p4c || ""),
      p5c: isTecnica ? formData.p5c : (oldContract.p5c || oldContractDataObj.p5c || ""),
      p6c: isTecnica ? formData.p6c : (oldContract.p6c || oldContractDataObj.p6c || ""),
    };

    const docxBuffer = await generateModificationDocxBuffer(templateData, isTecnica || isAutoconsumo);
    const { convertDocxToPdfViaDocuSign } = await import('@/lib/docusignConverter');
    const pdfBuffer = await convertDocxToPdfViaDocuSign(docxBuffer);
    const { uploadFileToR2 } = await import('@/lib/r2');
    const fileName = `MOD_${newCode || oldContract.id}_v${nextVersion}_${Date.now()}.pdf`;
    const uploadedUrl = await uploadFileToR2(`contracts/drafts/${fileName}`, pdfBuffer, 'application/pdf');

    // 2. Crear la nueva versión del contrato de forma atómica con su pdfUrl ya generado
    const newContract = await prisma.contract.create({
      data: {
        contractCode: newCode,
        version: nextVersion,
        clientId: newClientId,
        supplyPointId: newSupplyPointId,
        productId: oldContract.productId,
        brandId: oldContract.brandId,
        userId: oldContract.userId, 
        previousContractId: safePreviousContractId,
        tipo: 'M1',
        tipoC2: isSubrogation ? 'S' : 'N',
        tramitationType: isSubrogation ? 'Modificación de datos administrativos' : 'Modificación de datos técnicos',
        status: 'BORRADOR',
        signatureDate: oldContract.signatureDate,
        permanenceStartDate: oldContract.permanenceStartDate,
        expectedEndDate: oldContract.expectedEndDate,
        iban: ibanFinal || oldContract.iban,
        airtableData: newContractData,
        p1e: oldContract.p1e, p2e: oldContract.p2e, p3e: oldContract.p3e,
        p4e: oldContract.p4e, p5e: oldContract.p5e, p6e: oldContract.p6e,
        p1p: oldContract.p1p, p2p: oldContract.p2p, p3p: oldContract.p3p,
        p4p: oldContract.p4p, p5p: oldContract.p5p, p6p: oldContract.p6p,
        p1c: isTecnica && formData.p1c ? parseFloat(String(formData.p1c)) : oldContract.p1c,
        p2c: isTecnica && formData.p2c ? parseFloat(String(formData.p2c)) : oldContract.p2c,
        p3c: isTecnica && formData.p3c ? parseFloat(String(formData.p3c)) : oldContract.p3c,
        p4c: isTecnica && formData.p4c ? parseFloat(String(formData.p4c)) : oldContract.p4c,
        p5c: isTecnica && formData.p5c ? parseFloat(String(formData.p5c)) : oldContract.p5c,
        p6c: isTecnica && formData.p6c ? parseFloat(String(formData.p6c)) : oldContract.p6c,
        fee: oldContract.fee,
        marginFC: oldContract.marginFC,
        ip1: oldContract.ip1,
        ip2: oldContract.ip2,
        ip3: oldContract.ip3,
        ip4: oldContract.ip4,
        ip5: oldContract.ip5,
        ip6: oldContract.ip6,
        productTypeSnapshot: oldContract.productTypeSnapshot,
        commissionRuleType: oldContract.commissionRuleType,
        commissionRuleValue: oldContract.commissionRuleValue,
        additionalServicesSnapshot: oldContract.additionalServicesSnapshot ?? undefined,
        permanenceMonths: oldContract.permanenceMonths,
        pexc: isAutoconsumo ? (formData.surplusMode === 'FIJO' ? parseFloat(formData.pexc) : null) : oldContract.pexc,
        feeExcedentes: isAutoconsumo ? (formData.surplusMode === 'INDEXADO' ? parseFloat(formData.feeExcedentes) : null) : oldContract.feeExcedentes,
        commissionBase: oldContract.commissionBase,
        commissionFinal: oldContract.commissionFinal,
        commissionVariable: oldContract.commissionVariable,
        svaConcept: isSubrogation ? formData.servicio : oldContract.svaConcept,
        annualConsumption: oldContract.annualConsumption,
        filePdfSigned: oldContract.filePdfSigned,
        fileAnexoFirmado: oldContract.fileAnexoFirmado,
        pdfUrl: uploadedUrl,
      }
    });

    // Mover el Lead al nuevo contrato para no perder el consumo estimado y vínculo
    const leadToMove = await prisma.lead.findFirst({ where: { contractId: oldContract.id } });
    if (leadToMove) {
      await prisma.lead.update({
        where: { id: leadToMove.id },
        data: { contractId: newContract.id }
      });
    }

    revalidatePath('/contratos');
    revalidatePath(`/contratos/${oldContractId}`);

    return { success: true, newContractId: newContract.id };

  } catch (error: any) {
    console.error("Error en createContractModificationAction:", error);
    return { error: error.message };
  }
}

export async function createUnilateralModificationAction(
  oldContractId: string,
  parsedData: any
) {
  try {
    if (!parsedData?.fechaActivacionAlta) {
      return { error: "El XML de modificación unilateral (M2_05) no contiene Fecha de Activación válida." };
    }

    const oldContract = await prisma.contract.findUnique({
      where: { id: oldContractId },
      include: { supplyPoint: true }
    });

    if (!oldContract) throw new Error("Contrato original no encontrado");
    
    // 1. Actualizar SupplyPoint con datos técnicos y/o Autoconsumo del M2_05
    const spUpdates: any = {};
    if (parsedData.tarifaATR) {
      spUpdates.tariff = parsedData.tarifaATR;
    }
    if (Array.isArray(parsedData.potenciasContratadas)) {
      if (parsedData.potenciasContratadas[0] !== undefined) spUpdates.p1c = parsedData.potenciasContratadas[0];
      if (parsedData.potenciasContratadas[1] !== undefined) spUpdates.p2c = parsedData.potenciasContratadas[1];
      if (parsedData.potenciasContratadas[2] !== undefined) spUpdates.p3c = parsedData.potenciasContratadas[2];
      if (parsedData.potenciasContratadas[3] !== undefined) spUpdates.p4c = parsedData.potenciasContratadas[3];
      if (parsedData.potenciasContratadas[4] !== undefined) spUpdates.p5c = parsedData.potenciasContratadas[4];
      if (parsedData.potenciasContratadas[5] !== undefined) spUpdates.p6c = parsedData.potenciasContratadas[5];
    }
    if (parsedData.cau || parsedData.tipoAutoconsumo || parsedData.cil || parsedData.cauSubtype) {
      spUpdates.hasSelfConsumption = true;
      if (parsedData.cau) spUpdates.cau = parsedData.cau;
      if (parsedData.tipoAutoconsumo) spUpdates.selfConsumptionType = parsedData.tipoAutoconsumo;
      if (parsedData.cauSubtype) spUpdates.cauSubtype = parsedData.cauSubtype;
      if (parsedData.cauCollective) spUpdates.cauCollective = parsedData.cauCollective;
      if (parsedData.cil) spUpdates.cil = parsedData.cil;
      if (parsedData.generatorTechnology) spUpdates.generatorTechnology = parsedData.generatorTechnology;
      if (parsedData.installedPowerGen !== undefined) spUpdates.installedPowerGen = parsedData.installedPowerGen;
      if (parsedData.installationType) spUpdates.installationType = parsedData.installationType;
      if (parsedData.meteringScheme) spUpdates.meteringScheme = parsedData.meteringScheme;
    }

    if (Object.keys(spUpdates).length > 0 && oldContract.supplyPointId) {
      await prisma.supplyPoint.update({
        where: { id: oldContract.supplyPointId },
        data: spUpdates
      });
    }

    // 2. Crear nueva versión del contrato tomando la versión máxima existente del expediente
    const maxVersionRow = oldContract.contractCode
      ? await prisma.contract.findFirst({
          where: { contractCode: oldContract.contractCode, brandId: oldContract.brandId },
          orderBy: { version: 'desc' },
          select: { version: true }
        })
      : null;
    const nextVersion = (maxVersionRow?.version ?? oldContract.version ?? 0) + 1;
    const oldContractDataObj = (oldContract.airtableData as any) || {};

    const newContract = await prisma.contract.create({
      data: {
        contractCode: oldContract.contractCode,
        version: nextVersion,
        clientId: oldContract.clientId,
        supplyPointId: oldContract.supplyPointId,
        productId: oldContract.productId,
        brandId: oldContract.brandId,
        userId: oldContract.userId, 
        previousContractId: oldContract.id,
        tipo: 'M1',
        tipoC2: 'N',
        status: 'ACTIVO',
        activationDate: parsedData.fechaActivacionAlta,
        permanenceStartDate: oldContract.permanenceStartDate,
        iban: oldContract.iban,
        airtableData: oldContractDataObj,
        p1e: oldContract.p1e, p2e: oldContract.p2e, p3e: oldContract.p3e,
        p4e: oldContract.p4e, p5e: oldContract.p5e, p6e: oldContract.p6e,
        p1p: oldContract.p1p, p2p: oldContract.p2p, p3p: oldContract.p3p,
        p4p: oldContract.p4p, p5p: oldContract.p5p, p6p: oldContract.p6p,
        p1c: parsedData.potenciasContratadas?.[0] ?? oldContract.p1c,
        p2c: parsedData.potenciasContratadas?.[1] ?? oldContract.p2c,
        p3c: parsedData.potenciasContratadas?.[2] ?? oldContract.p3c,
        p4c: parsedData.potenciasContratadas?.[3] ?? oldContract.p4c,
        p5c: parsedData.potenciasContratadas?.[4] ?? oldContract.p5c,
        p6c: parsedData.potenciasContratadas?.[5] ?? oldContract.p6c,
        fee: oldContract.fee,
        marginFC: oldContract.marginFC,
        ip1: oldContract.ip1,
        ip2: oldContract.ip2,
        ip3: oldContract.ip3,
        ip4: oldContract.ip4,
        ip5: oldContract.ip5,
        ip6: oldContract.ip6,
        productTypeSnapshot: oldContract.productTypeSnapshot,
        commissionRuleType: oldContract.commissionRuleType,
        commissionRuleValue: oldContract.commissionRuleValue,
        additionalServicesSnapshot: oldContract.additionalServicesSnapshot ?? undefined,
        permanenceMonths: oldContract.permanenceMonths,
        annualConsumption: oldContract.annualConsumption,
        commissionBase: oldContract.commissionBase,
        commissionFinal: oldContract.commissionFinal,
        commissionVariable: oldContract.commissionVariable,
        svaConcept: oldContract.svaConcept,
        filePdfSigned: oldContract.filePdfSigned,
        fileAnexoFirmado: oldContract.fileAnexoFirmado,
        pdfUrl: oldContract.pdfUrl // Copiamos el enlace al PDF original, pues no se autogenera uno nuevo
      }
    });

    // 3. Marcar el contrato anterior como FINALIZADO un día antes
    const prevTermDate = new Date(parsedData.fechaActivacionAlta);
    prevTermDate.setDate(prevTermDate.getDate() - 1);
    
    await prisma.contract.update({
      where: { id: oldContract.id },
      data: { 
        status: 'FINALIZADO',
        terminationDate: prevTermDate
      }
    });

    // Mover el Lead al nuevo contrato para no perder el consumo estimado y vínculo
    const leadToMove = await prisma.lead.findFirst({ where: { contractId: oldContract.id } });
    if (leadToMove) {
      await prisma.lead.update({
        where: { id: leadToMove.id },
        data: { contractId: newContract.id }
      });
    }

    revalidatePath(`/contratos/${oldContractId}`);
    return { success: true, newContractId: newContract.id };

  } catch (error: any) {
    console.error("Error en createUnilateralModificationAction:", error);
    return { error: error.message };
  }
}

