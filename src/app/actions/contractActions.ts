'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import docusign from 'docusign-esign';
import { createAndSendEnvelope } from '@/lib/docusign';
import { buildTemplateDataFromLead, getSupplyAddress } from '@/lib/templateBuilder';
import { getTramitationCodes } from '@/lib/tramitationMapper';

export async function convertLeadToContractAction(leadId: string) {
  try {
    // 1. Verificar si ya existe un contrato para este Lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { contract: true, user: { include: { brand: true } } },
    });

    if (!lead) {
      return { error: 'Lead no encontrado.' };
    }

    if (lead.contractId) {
      return { error: 'Este Lead ya ha sido convertido a Contrato.' };
    }

    // --- VALIDACIONES DE NEGOCIO ---
    const validationErrors: string[] = [];
    const cData: any = lead.contractData || {};

    // 1. SIPS OK
    if (!lead.sipsOk && lead.sipsMessages && lead.sipsMessages.length > 0 && lead.sipsMessages !== 'SIPS Refrescado Correctamente') {
      validationErrors.push(`Aviso de SIPS pendiente de revisión: ${lead.sipsMessages}`);
    }

    // 2. Error NIF apoderado/titular
    const vat = lead.vatNumber || cData.nif || '';
    if (!vat || !/^[A-Z0-9]{8,9}$/i.test(vat.replace(/[-\s]/g, ''))) {
      validationErrors.push("El NIF/CIF del titular está vacío o no tiene un formato válido.");
    }

    // 2.5 Validación de Apoderado para Personas Jurídicas
    const isJuridica = /^[A-W]/i.test(vat.replace(/[-\s]/g, '')) && !/^[XYZ]/i.test(vat.replace(/[-\s]/g, ''));
    if (isJuridica) {
      const apoderadoNombre = cData.contactoNombre || '';
      const apoderadoApellidos = cData.contactoApellidos || '';
      const apoderadoNif = cData.contactoNif;

      if (!apoderadoNombre || !apoderadoApellidos || !apoderadoNif) {
        validationErrors.push("Para personas jurídicas (empresas o comunidades), es obligatorio rellenar los datos del Apoderado (Nombre, Apellidos y NIF).");
      }
    }

    // 3. Error CP Titular y Suministro
    const cpTitular = cData.cp || cData.codigoPostal || cData.direccion?.cp;
    if (cpTitular && !/^\d{5}$/.test(String(cpTitular).trim())) {
      validationErrors.push("El Código Postal del Titular debe tener 5 dígitos.");
    }
    const cpSuministro = cData.sCp || cData.direccionSuministro?.cp || cData.direccion?.cp || cpTitular;
    if (!cpSuministro || !/^\d{5}$/.test(String(cpSuministro).trim())) {
      validationErrors.push("El Código Postal del Punto de Suministro debe tener 5 dígitos.");
    }

    // 4. Tarifa / Consumo (SIPS Jerarquía)
    let finalConsumptionMWh = lead.estimatedMWh || 0;
    const sRaw: any = lead.sipsRawData || {};
    const sipsConsumoKWh = Number(sRaw.consumo || sRaw.Consumo || sRaw.annualConsumption || 0);
    const sipsConsumoMWh = sipsConsumoKWh / 1000;

    if (sipsConsumoMWh > 0) {
      finalConsumptionMWh = sipsConsumoMWh;
    }

    if (finalConsumptionMWh <= 0) {
      validationErrors.push("El consumo anual estimado debe ser mayor a 0. SIPS no devolvió un consumo válido y no se ha introducido manualmente en la ficha del Lead.");
    } else {
      lead.estimatedMWh = finalConsumptionMWh;
    }

    if (!cData.cnae) {
      validationErrors.push("El CNAE no puede estar vacío.");
    }

    // 5. Comparar CP y CNAE con SIPS (Universal: BD o sipsRawData)
    if (lead.cups) {
      const brandIdToUse = lead.user?.brandId || (await prisma.brand.findFirst())?.id || '';
      const dbSupplyPoint = await prisma.supplyPoint.findFirst({
        where: {
          cups: { startsWith: lead.cups.substring(0, 20) },
          client: { brandId: brandIdToUse }
        }
      });

      let sipsPostalCode: string | null = null;
      let sipsCnae: string | null = null;
      let sipsTariff: string | null = null;
      let sipsP: (number | null)[] = [null, null, null, null, null, null];

      if (dbSupplyPoint) {
         sipsPostalCode = dbSupplyPoint.sipsPostalCode;
         sipsCnae = dbSupplyPoint.sipsCnae;
         sipsTariff = dbSupplyPoint.sipsTariff;
         sipsP = [dbSupplyPoint.sipsP1c, dbSupplyPoint.sipsP2c, dbSupplyPoint.sipsP3c, dbSupplyPoint.sipsP4c, dbSupplyPoint.sipsP5c, dbSupplyPoint.sipsP6c];
      }

      // Fallback a lead.sipsRawData
      const sRaw: any = lead.sipsRawData || {};
      if (!sipsPostalCode && (sRaw.postalCode || sRaw.codigoPostal || sRaw.cp)) {
         sipsPostalCode = String(sRaw.postalCode || sRaw.codigoPostal || sRaw.cp);
      }
      if (!sipsCnae && sRaw.cnae) sipsCnae = String(sRaw.cnae);
      if (!sipsTariff && (sRaw.tariff || sRaw.tarifa)) sipsTariff = String(sRaw.tariff || sRaw.tarifa);
      
      for(let i=1; i<=6; i++) {
         if (sipsP[i-1] === null) {
            const rawP = sRaw[`p${i}`] || sRaw[`p${i}c`];
            if (rawP !== undefined && rawP !== null) {
                sipsP[i-1] = parseFloat(rawP);
            }
         }
      }

      if (sipsPostalCode && cpSuministro && sipsPostalCode !== cpSuministro) {
        validationErrors.push(`El Código Postal introducido (${cpSuministro}) no coincide con el del SIPS (${sipsPostalCode}).`);
      }
      if (sipsCnae && cData.cnae && sipsCnae !== cData.cnae) {
        validationErrors.push(`El CNAE introducido (${cData.cnae}) no coincide con el del SIPS (${sipsCnae}).`);
      }

      // 6. Validar Potencias y Tarifa si no hay cambios técnicos
      const tramitacion = cData.tipoTramitacion || '';
      const requiereVerificacionTecnica = [
        'Cambio comercializadora sin cambios',
        'Cambio comercializadora con cambios administrativos',
        'Modificación de datos administrativos'
      ].includes(tramitacion);

      if (requiereVerificacionTecnica) {
        if (sipsTariff && lead.tariff && sipsTariff !== lead.tariff) {
          validationErrors.push(`La tarifa solicitada (${lead.tariff}) no coincide con la del SIPS (${sipsTariff}) para este tipo de tramitación.`);
        }
        for (let i = 1; i <= 6; i++) {
          const reqPStr = cData.potencias?.[`p${i}`] || cData[`p${i}c`] || cData[`p${i}`];
          const reqP = parseFloat(reqPStr);
          const sP = sipsP[i-1];
          if (!isNaN(reqP) && sP !== null && sP !== undefined) {
             if (Math.abs(reqP - sP) > 0.01) {
                validationErrors.push(`La potencia P${i} solicitada (${reqP} kW) no coincide con la del SIPS (${sP} kW). Selecciona un trámite 'con cambios técnicos' si deseas alterarla.`);
             }
          }
        }
      }
    }

    // 7. Validar congruencia de Tarifa del Producto
    if (lead.product) {
      let p = null;
      if (lead.product.startsWith('cm')) {
        p = await prisma.product.findUnique({ where: { id: lead.product } });
      } else {
        p = await prisma.product.findFirst({ where: { name: lead.product.trim() } });
      }
      
      if (p && p.tariff && lead.tariff && p.tariff !== lead.tariff) {
        validationErrors.push(`Incongruencia: El producto seleccionado (${p.name}) es para la tarifa ${p.tariff}, pero el contrato se intenta generar con la tarifa ${lead.tariff}.`);
      }
    }

    if (validationErrors.length > 0) {
      return { 
        error: 'VALIDATION_FAILED',
        validationErrors 
      };
    }
    // --- FIN VALIDACIONES ---

    const isMultipoint = lead.isMultipoint || lead.businessName.toUpperCase().includes('ERANOVUM');

    let contactEmail = lead.email;
    let contactEmail2 = '';
    let contactEmail3 = '';

    if (isMultipoint && lead.businessName.toUpperCase().includes('ERANOVUM')) {
       cData.emailFactura = 'finance@eranovum.energy';
       contactEmail2 = 'roger@iseoenergia.es';
       contactEmail3 = 'pm.emobility@eranovum.energy';
       cData.duracionSVA = 1;
    }

    // 2. Necesitamos un Client. Buscamos por NIF o creamos.
    const vatNum = lead.vatNumber || `PENDING-${lead.id}`;
    const brandIdToUse = lead.user?.brandId || (await prisma.brand.findFirst())?.id || '';
    let client = await prisma.client.findUnique({
      where: { vatNumber_brandId: { vatNumber: vatNum, brandId: brandIdToUse } }
    });
    
    if (client) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          businessName: lead.businessName,
          firstName: cData.contactoNombre || '',
          lastName: cData.contactoApellidos || '',
          contactEmail: contactEmail || client.contactEmail,
          contactEmail2: contactEmail2 || client.contactEmail2,
          contactEmail3: contactEmail3 || client.contactEmail3,
          contactPhone: lead.phone || client.contactPhone,
          clientType: cData.tipoCliente || client.clientType,
          isMultipoint: isMultipoint || client.isMultipoint,
        }
      });
    } else {
      client = await prisma.client.create({
        data: {
          businessName: lead.businessName,
          firstName: cData.contactoNombre || '',
          lastName: cData.contactoApellidos || '',
          vatNumber: vatNum,
          contactEmail: contactEmail,
          contactEmail2: contactEmail2,
          contactEmail3: contactEmail3,
          contactPhone: lead.phone,
          clientType: cData.tipoCliente || (/^([0-9XYZ])/i.test(vatNum) ? 'Persona física' : 'Empresa'),
          brandId: brandIdToUse,
          isMultipoint: isMultipoint,
        }
      });
    }

    // 3. Necesitamos un SupplyPoint. Buscamos por CUPS.
    const targetCups = lead.cups || `CUPS-PENDING-${lead.id}`;
    let supplyPoint = await prisma.supplyPoint.findFirst({
      where: { cups: targetCups, clientId: client.id },
      include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    let previousContractId = null;

    if (supplyPoint) {
      if (supplyPoint.contracts && supplyPoint.contracts.length > 0) {
        previousContractId = supplyPoint.contracts[0].id;
      }
    } else {
      supplyPoint = await prisma.supplyPoint.create({
        data: {
          cups: targetCups,
          address: getSupplyAddress(cData) || 'Pendiente',
          city: cData.sPoblacion || cData.poblacion || cData['Población Instalación'] || 'Pendiente',
          postalCode: cData.sCp || cData.cp || cData['Código Postal Instalación'] || '00000',
          province: cData.sProvincia || cData.provincia || cData['Provincia Instalación'] || 'Pendiente',
          tariff: lead.tariff || '2.0TD',
          clientId: client.id,
        },
        include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });
    }

    // 4. Necesitamos un Product. Buscamos uno o creamos genérico.
    let product = null;
    if (lead.product && lead.product.startsWith('cm')) {
      product = await prisma.product.findUnique({ where: { id: lead.product } });
    } else {
      const pName = (lead.product || 'Producto Genérico').trim();
      product = await prisma.product.findFirst({ where: { name: pName } });
    }

    if (!product) {
      const brand = await prisma.brand.findFirst(); // Asumimos que hay al menos una marca
      if (!brand) throw new Error("No hay marcas configuradas en el sistema.");
      product = await prisma.product.create({
        data: {
          name: (lead.product || 'Producto Genérico').trim(),
          type: lead.productType || 'FIX',
          brandId: brand.id,
        }
      });
    }

    // Generación de código de contrato
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    const isCompany = client.vatNumber.toUpperCase().startsWith('A') || client.vatNumber.toUpperCase().startsWith('B');
    const typeChar = isCompany ? 'E' : 'P';
    
    const brandPrefix = lead.user?.brand?.codigoMarca || 'AED';
    const userPrefix = lead.user?.codigo || 'U';
    const prefix = `${brandPrefix}${userPrefix}${typeChar}`;
    
    const cupsLast4 = supplyPoint.cups ? supplyPoint.cups.slice(-4) : '0000';
    
    let contractCode = `${prefix}${year}${month}${day}${hour}${min}${cupsLast4}`;
    
    // Para asegurar unicidad 100% en caso de concurrencia en el mismo minuto
    const existingCode = await prisma.contract.findFirst({ where: { contractCode } });
    if (existingCode) {
      contractCode = `${contractCode}-${Math.floor(Math.random() * 1000)}`;
    }

    // 5. Crear el contrato
    const contract = await prisma.contract.create({
      data: {
        userId: lead.userId,
        clientId: client.id,
        supplyPointId: supplyPoint.id,
        productId: product.id,
        status: isMultipoint ? 'ACEPTADO' : 'BORRADOR',
        previousContractId: previousContractId,
        contractCode,
        iban: cData.iban || null,
        tramitationType: cData.tipoTramitacion || 'Alta nueva',
        tipo: getTramitationCodes(cData.tipoTramitacion || 'Alta nueva').tipo,
        tipoC2: getTramitationCodes(cData.tipoTramitacion || 'Alta nueva').tipoC2,
        p1c: parseFloat(cData.potencias?.p1 || cData.p1c || cData.p1) || null,
        p2c: parseFloat(cData.potencias?.p2 || cData.p2c || cData.p2) || null,
        p3c: parseFloat(cData.potencias?.p3 || cData.p3c || cData.p3) || null,
        p4c: parseFloat(cData.potencias?.p4 || cData.p4c || cData.p4) || null,
        p5c: parseFloat(cData.potencias?.p5 || cData.p5c || cData.p5) || null,
        p6c: parseFloat(cData.potencias?.p6 || cData.p6c || cData.p6) || null,
        p1p: parseFloat(cData['P1P'] || cData['P1P (from Producto)']?.[0]) || product.p1p || null,
        p2p: parseFloat(cData['P2P'] || cData['P2P (from Producto)']?.[0]) || product.p2p || null,
        p3p: parseFloat(cData['P3P'] || cData['P3P (from Producto)']?.[0]) || product.p3p || null,
        p4p: parseFloat(cData['P4P'] || cData['P4P (from Producto)']?.[0]) || product.p4p || null,
        p5p: parseFloat(cData['P5P'] || cData['P5P (from Producto)']?.[0]) || product.p5p || null,
        p6p: parseFloat(cData['P6P'] || cData['P6P (from Producto)']?.[0]) || product.p6p || null,
        p1e: parseFloat(cData['P1E'] || cData['P1E (from Producto)']?.[0]) || product.p1e || null,
        p2e: parseFloat(cData['P2E'] || cData['P2E (from Producto)']?.[0]) || product.p2e || null,
        p3e: parseFloat(cData['P3E'] || cData['P3E (from Producto)']?.[0]) || product.p3e || null,
        p4e: parseFloat(cData['P4E'] || cData['P4E (from Producto)']?.[0]) || product.p4e || null,
        p5e: parseFloat(cData['P5E'] || cData['P5E (from Producto)']?.[0]) || product.p5e || null,
        p6e: parseFloat(cData['P6E'] || cData['P6E (from Producto)']?.[0]) || product.p6e || null,
        fee: parseFloat(cData['Fee Index'] || cData['Fee Index (from Producto)']?.[0]) || product.fee || null,
        pexc: parseFloat(cData.pexc) || product.pexc || null,
        feeExcedentes: parseFloat(cData.feeExcedentes) || product.feeExcedentes || null,
        cgBolsilloSolar: parseFloat(cData.cgBolsilloSolar) || product.cgBolsilloSolar || null,
        deviationCost: parseFloat(cData.deviationCost) || product.deviationCost || null,
        pricingModel: product.pricingModel || null,
        commissionType: product.commissionType || null,
        powerTiersCommission: product.powerTiersCommission ? product.powerTiersCommission : undefined,
        permanenceMonths: product.permanenceMonths || null,
      },
    });

    // 3. Generar DOCX, convertir a PDF vía DocuSign y subir a R2
    try {
      const { generateContractDocxBuffer } = await import('@/lib/docGenerator');
      const { convertDocxToPdfViaDocuSign } = await import('@/lib/docusignConverter');
      const { uploadFileToR2 } = await import('@/lib/r2');
      
      const vat = (lead.vatNumber || '').trim().toUpperCase();
      const isPersonaFisica = /^[0-9XYZ]/.test(vat) && vat.length === 9;
      const cnae = (cData.cnae || '').trim();
      const isCore = isPersonaFisica && (cnae === '9820' || cnae === '9821');
      const isB2B = !isCore;

      const formatField = (field: any): string => {
        if (!field) return '';
        if (typeof field === 'string') return field;
        if (Array.isArray(field)) return field.map(formatField).join(', ');
        if (typeof field === 'object') {
          if (field.tipoVia && field.nombreVia) {
            const parts = [
              field.tipoVia,
              field.nombreVia,
              field.tipoNumeracion ? `${field.tipoNumeracion} ${field.numKm || field.numero || ''}`.trim() : (field.numKm || field.numero || ''),
              field.adicional
            ].filter(Boolean);
            return parts.join(' ');
          }
          return field.address || field.name || field.value || field.street || JSON.stringify(field);
        }
        return String(field);
      };

      const extractAddrObj = (field: any) => {
        if (!field) return {};
        if (typeof field === 'string' && field.startsWith('{')) {
          try { return JSON.parse(field); } catch(e){ return {}; }
        }
        if (typeof field === 'object' && !Array.isArray(field)) return field;
        return {};
      };

      const dirTitObj = extractAddrObj(cData.direccion);
      const dirPSObj = extractAddrObj(cData.direccionSuministro);
      const templateData = buildTemplateDataFromLead(lead, cData, product, contract, isB2B, client, supplyPoint);

      const docxBuffer = await generateContractDocxBuffer(templateData, isB2B);
      
      // Convertir a PDF usando DocuSign como conversor de alta fidelidad
      const pdfBuffer = await convertDocxToPdfViaDocuSign(docxBuffer);
      
      const fileName = `Contrato_AED_${contract.contractCode}.pdf`;
      const uploadedUrl = await uploadFileToR2(`contracts/drafts/${fileName}`, pdfBuffer, 'application/pdf');

      await prisma.contract.update({
        where: { id: contract.id },
        data: { pdfUrl: uploadedUrl }
      });
    } catch (pdfError: any) {
      console.error("Error generando PDF para el contrato nativo:", pdfError);
      return { error: 'Error crítico al generar PDF: ' + (pdfError.message || String(pdfError)) };
    }

    // 4. Vincular el Contrato al Lead y cambiar el estado del Lead a CONTRATADO
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        contractId: contract.id,
        status: 'CONTRATADO',
        contractData: cData,
        estimatedMWh: lead.estimatedMWh,
      },
    });

    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/contratos');

    return { success: true, contractId: contract.id };
  } catch (error: any) {
    console.error("Error al convertir Lead a Contrato:", error);
    return { error: 'Ocurrió un error inesperado al procesar la conversión.' };
  }
}

export async function remakeContractAction(leadId: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { contract: { include: { client: true, supplyPoint: true } }, user: { include: { brand: true } } },
    });

    if (!lead) {
      return { error: 'Lead no encontrado.' };
    }

    if (!lead.contractId || !lead.contract) {
      return { error: 'Este Lead no tiene ningún contrato asociado para rehacer.' };
    }

    // --- VALIDACIONES DE NEGOCIO ---
    const validationErrors: string[] = [];
    const cData: any = lead.contractData || {};

    // 1. SIPS OK
    if (!lead.sipsOk && lead.sipsMessages && lead.sipsMessages.length > 0 && lead.sipsMessages !== 'SIPS Refrescado Correctamente') {
      validationErrors.push(`Aviso de SIPS pendiente de revisión: ${lead.sipsMessages}`);
    }

    // 2. Error NIF apoderado/titular
    const vat = lead.vatNumber || cData.nif;
    if (!vat || !/^[A-Z0-9]{8,9}$/i.test(vat.replace(/[-\s]/g, ''))) {
      validationErrors.push("El NIF/CIF del titular está vacío o no tiene un formato válido.");
    }

    // 2.5 Validación de Apoderado para Personas Jurídicas
    const isJuridica = /^[A-W]/i.test(vat.replace(/[-\s]/g, '')) && !/^[XYZ]/i.test(vat.replace(/[-\s]/g, ''));
    if (isJuridica) {
      const apoderadoNombre = cData.contactoNombre || '';
      const apoderadoApellidos = cData.contactoApellidos || '';
      const apoderadoNif = cData.contactoNif;

      if (!apoderadoNombre || !apoderadoApellidos || !apoderadoNif) {
        validationErrors.push("Para personas jurídicas (empresas o comunidades), es obligatorio rellenar los datos del Apoderado (Nombre, Apellidos y NIF).");
      }
    }

    // 3. Error CP Titular y Suministro
    const cpTitular = cData.cp || cData.codigoPostal || cData.direccion?.cp;
    if (cpTitular && !/^\d{5}$/.test(String(cpTitular).trim())) {
      validationErrors.push("El Código Postal del Titular debe tener 5 dígitos.");
    }
    const cpSuministro = cData.sCp || cData.direccionSuministro?.cp || cData.direccion?.cp || cpTitular;
    if (!cpSuministro || !/^\d{5}$/.test(String(cpSuministro).trim())) {
      validationErrors.push("El Código Postal del Punto de Suministro debe tener 5 dígitos.");
    }

    // 4. Tarifa / Consumo (SIPS Jerarquía)
    let finalConsumptionMWh = lead.estimatedMWh || 0;
    const sRaw: any = lead.sipsRawData || {};
    const sipsConsumoKWh = Number(sRaw.consumo || sRaw.Consumo || sRaw.annualConsumption || 0);
    const sipsConsumoMWh = sipsConsumoKWh / 1000;

    if (sipsConsumoMWh > 0) {
      finalConsumptionMWh = sipsConsumoMWh;
    }

    if (finalConsumptionMWh <= 0) {
      validationErrors.push("El consumo anual estimado debe ser mayor a 0. SIPS no devolvió un consumo válido y no se ha introducido manualmente en la ficha del Lead.");
    } else {
      lead.estimatedMWh = finalConsumptionMWh;
    }

    if (!cData.cnae) {
      validationErrors.push("El CNAE no puede estar vacío.");
    }

    // 5. Comparar CP y CNAE con SIPS (Universal: BD o sipsRawData)
    if (lead.cups) {
      const brandIdToUse = lead.user?.brandId || (await prisma.brand.findFirst())?.id || '';
      const dbSupplyPoint = await prisma.supplyPoint.findFirst({
        where: {
          cups: { startsWith: lead.cups.substring(0, 20) },
          client: { brandId: brandIdToUse }
        }
      });

      let sipsPostalCode: string | null = null;
      let sipsCnae: string | null = null;
      let sipsTariff: string | null = null;
      let sipsP: (number | null)[] = [null, null, null, null, null, null];

      if (dbSupplyPoint) {
         sipsPostalCode = dbSupplyPoint.sipsPostalCode;
         sipsCnae = dbSupplyPoint.sipsCnae;
         sipsTariff = dbSupplyPoint.sipsTariff;
         sipsP = [dbSupplyPoint.sipsP1c, dbSupplyPoint.sipsP2c, dbSupplyPoint.sipsP3c, dbSupplyPoint.sipsP4c, dbSupplyPoint.sipsP5c, dbSupplyPoint.sipsP6c];
      }

      // Fallback a lead.sipsRawData
      const sRaw: any = lead.sipsRawData || {};
      if (!sipsPostalCode && (sRaw.postalCode || sRaw.codigoPostal || sRaw.cp)) {
         sipsPostalCode = String(sRaw.postalCode || sRaw.codigoPostal || sRaw.cp);
      }
      if (!sipsCnae && sRaw.cnae) sipsCnae = String(sRaw.cnae);
      if (!sipsTariff && (sRaw.tariff || sRaw.tarifa)) sipsTariff = String(sRaw.tariff || sRaw.tarifa);
      
      for(let i=1; i<=6; i++) {
         if (sipsP[i-1] === null) {
            const rawP = sRaw[`p${i}`] || sRaw[`p${i}c`];
            if (rawP !== undefined && rawP !== null) {
                sipsP[i-1] = parseFloat(rawP);
            }
         }
      }

      if (sipsPostalCode && cpSuministro && sipsPostalCode !== cpSuministro) {
        validationErrors.push(`El Código Postal introducido (${cpSuministro}) no coincide con el del SIPS (${sipsPostalCode}).`);
      }
      if (sipsCnae && cData.cnae && sipsCnae !== cData.cnae) {
        validationErrors.push(`El CNAE introducido (${cData.cnae}) no coincide con el del SIPS (${sipsCnae}).`);
      }

      // 6. Validar Potencias y Tarifa si no hay cambios técnicos
      const tramitacion = cData.tipoTramitacion || '';
      const requiereVerificacionTecnica = [
        'Cambio comercializadora sin cambios',
        'Cambio comercializadora con cambios administrativos',
        'Modificación de datos administrativos'
      ].includes(tramitacion);

      if (requiereVerificacionTecnica) {
        if (sipsTariff && lead.tariff && sipsTariff !== lead.tariff) {
          validationErrors.push(`La tarifa solicitada (${lead.tariff}) no coincide con la del SIPS (${sipsTariff}) para este tipo de tramitación.`);
        }
        for (let i = 1; i <= 6; i++) {
          const reqPStr = cData.potencias?.[`p${i}`] || cData[`p${i}c`] || cData[`p${i}`];
          const reqP = parseFloat(reqPStr);
          const sP = sipsP[i-1];
          if (!isNaN(reqP) && sP !== null && sP !== undefined) {
             if (Math.abs(reqP - sP) > 0.01) {
                validationErrors.push(`La potencia P${i} solicitada (${reqP} kW) no coincide con la del SIPS (${sP} kW). Selecciona un trámite 'con cambios técnicos' si deseas alterarla.`);
             }
          }
        }
      }
    }

    // 7. Validar congruencia de Tarifa del Producto
    if (lead.product) {
      let p = null;
      if (lead.product.startsWith('cm')) {
        p = await prisma.product.findUnique({ where: { id: lead.product } });
      } else {
        p = await prisma.product.findFirst({ where: { name: lead.product.trim() } });
      }
      
      if (p && p.tariff && lead.tariff && p.tariff !== lead.tariff) {
        validationErrors.push(`Incongruencia: El producto seleccionado (${p.name}) es para la tarifa ${p.tariff}, pero el contrato se intenta generar con la tarifa ${lead.tariff}.`);
      }
    }

    if (validationErrors.length > 0) {
      return { 
        error: 'VALIDATION_FAILED',
        validationErrors 
      };
    }
    // --- FIN VALIDACIONES ---

    const isMultipoint = lead.isMultipoint || lead.businessName.toUpperCase().includes('ERANOVUM');

    let contactEmail = lead.email;
    let contactEmail2 = '';
    let contactEmail3 = '';

    if (isMultipoint && lead.businessName.toUpperCase().includes('ERANOVUM')) {
       cData.emailFactura = 'finance@eranovum.energy';
       contactEmail2 = 'roger@iseoenergia.es';
       contactEmail3 = 'pm.emobility@eranovum.energy';
       cData.duracionSVA = 1;
    }

    // Actualizar Cliente
    await prisma.client.update({
      where: { id: lead.contract.clientId },
      data: {
        businessName: lead.businessName,
        firstName: cData.contactoNombre || '',
        lastName: cData.contactoApellidos || '',
        vatNumber: lead.vatNumber || `PENDING-${lead.id}`,
        contactEmail: contactEmail,
        contactEmail2: contactEmail2,
        contactEmail3: contactEmail3,
        contactPhone: lead.phone,
        clientType: cData.tipoCliente || (lead.vatNumber && /^([0-9XYZ])/i.test(lead.vatNumber) ? 'Persona física' : 'Empresa'),
        isMultipoint: isMultipoint,
      }
    });

    // Actualizar Punto de Suministro
    await prisma.supplyPoint.update({
      where: { id: lead.contract.supplyPointId },
      data: {
        cups: lead.cups || `CUPS-PENDING-${lead.id}`,
        address: typeof cData.direccion === 'string' ? cData.direccion : (cData.direccion?.address || cData.direccion?.direccion || 'Pendiente'),
        city: cData.poblacion || 'Pendiente',
        postalCode: cData.cp || '00000',
        province: cData.provincia || 'Pendiente',
        tariff: lead.tariff || '2.0TD',
      }
    });

    // Producto
    let product = null;
    if (lead.product && lead.product.startsWith('cm')) {
      product = await prisma.product.findUnique({ where: { id: lead.product } });
    } else {
      const pName = (lead.product || 'Producto Genérico').trim();
      product = await prisma.product.findFirst({ where: { name: pName } });
    }

    if (!product) {
      const brand = await prisma.brand.findFirst();
      if (brand) {
        product = await prisma.product.create({
          data: {
            name: (lead.product || 'Producto Genérico').trim(),
            type: lead.productType || 'FIX',
            brandId: brand.id,
          }
        });
      }
    }

    // Actualizar Contrato
    await prisma.contract.update({
      where: { id: lead.contract.id },
      data: {
        productId: product?.id || lead.contract.productId,
        status: isMultipoint ? 'ACEPTADO' : 'BORRADOR', // Vuelve a Borrador al rehacer salvo si es Multipunto
        updatedAt: new Date(),
        p1c: parseFloat(cData.potencias?.p1 || cData.p1c || cData.p1) || null,
        p2c: parseFloat(cData.potencias?.p2 || cData.p2c || cData.p2) || null,
        p3c: parseFloat(cData.potencias?.p3 || cData.p3c || cData.p3) || null,
        p4c: parseFloat(cData.potencias?.p4 || cData.p4c || cData.p4) || null,
        p5c: parseFloat(cData.potencias?.p5 || cData.p5c || cData.p5) || null,
        p6c: parseFloat(cData.potencias?.p6 || cData.p6c || cData.p6) || null,
        p1p: parseFloat(cData['P1P'] || cData['P1P (from Producto)']?.[0]) || product?.p1p || null,
        p2p: parseFloat(cData['P2P'] || cData['P2P (from Producto)']?.[0]) || product?.p2p || null,
        p3p: parseFloat(cData['P3P'] || cData['P3P (from Producto)']?.[0]) || product?.p3p || null,
        p4p: parseFloat(cData['P4P'] || cData['P4P (from Producto)']?.[0]) || product?.p4p || null,
        p5p: parseFloat(cData['P5P'] || cData['P5P (from Producto)']?.[0]) || product?.p5p || null,
        p6p: parseFloat(cData['P6P'] || cData['P6P (from Producto)']?.[0]) || product?.p6p || null,
        p1e: parseFloat(cData['P1E'] || cData['P1E (from Producto)']?.[0]) || product?.p1e || null,
        p2e: parseFloat(cData['P2E'] || cData['P2E (from Producto)']?.[0]) || product?.p2e || null,
        p3e: parseFloat(cData['P3E'] || cData['P3E (from Producto)']?.[0]) || product?.p3e || null,
        p4e: parseFloat(cData['P4E'] || cData['P4E (from Producto)']?.[0]) || product?.p4e || null,
        p5e: parseFloat(cData['P5E'] || cData['P5E (from Producto)']?.[0]) || product?.p5e || null,
        p6e: parseFloat(cData['P6E'] || cData['P6E (from Producto)']?.[0]) || product?.p6e || null,
        fee: parseFloat(cData['Fee Index'] || cData['Fee Index (from Producto)']?.[0]) || product?.fee || null,
        pexc: parseFloat(cData.pexc) || product?.pexc || null,
        feeExcedentes: parseFloat(cData.feeExcedentes) || product?.feeExcedentes || null,
        cgBolsilloSolar: parseFloat(cData.cgBolsilloSolar) || product?.cgBolsilloSolar || null,
        deviationCost: parseFloat(cData.deviationCost) || product?.deviationCost || null,
        pricingModel: product?.pricingModel || null,
        commissionType: product?.commissionType || null,
        powerTiersCommission: product?.powerTiersCommission ? product.powerTiersCommission : undefined,
        permanenceMonths: product?.permanenceMonths || null,
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { 
        contractData: cData,
        estimatedMWh: lead.estimatedMWh
      }
    });

    if (!isMultipoint) {
      try {
        const { buildTemplateDataFromLead } = await import('@/lib/templateBuilder');
        const { generateContractDocxBuffer } = await import('@/lib/docGenerator');
        const { convertDocxToPdfViaDocuSign } = await import('@/lib/docusignConverter');
        const { uploadFileToR2 } = await import('@/lib/r2');

        const vat = lead.vatNumber || '';
        const isPersonaFisica = /^[0-9XYZ]/.test(vat) && vat.length === 9;
        const cnae = (cData.cnae || '').trim();
        const isCore = isPersonaFisica && (cnae === '9820' || cnae === '9821');
        const isB2B = !isCore;

        const templateData = buildTemplateDataFromLead(lead, cData, product, lead.contract, isB2B, lead.contract?.client, lead.contract?.supplyPoint);
        const docxBuffer = await generateContractDocxBuffer(templateData, isB2B);
        
        const pdfBuffer = await convertDocxToPdfViaDocuSign(docxBuffer);
        
        const fileName = `Contrato_AED_${lead.contract.contractCode}.pdf`;
        const uploadedUrl = await uploadFileToR2(`contracts/drafts/${fileName}`, pdfBuffer, 'application/pdf');

        await prisma.contract.update({
          where: { id: lead.contract.id },
          data: { pdfUrl: uploadedUrl }
        });
      } catch (pdfError: any) {
        console.error("Error generando PDF al rehacer el contrato nativo:", pdfError);
        return { error: 'Error crítico al regenerar PDF: ' + (pdfError.message || String(pdfError)) };
      }
    }

    return { success: true, contractId: lead.contract.id };

  } catch (error: any) {
    console.error("Error al rehacer Contrato:", error);
    return { error: 'Ocurrió un error inesperado al rehacer el contrato.' };
  }
}

function getContractStatusFromDates(
  signatureDate: Date | null | undefined,
  requestDate: Date | null | undefined,
  activationDate: Date | null | undefined,
  terminationDate: Date | null | undefined
): string {
  if (terminationDate && activationDate) return 'BAJA';
  if (activationDate) return 'ACTIVO';
  if (requestDate) return 'TRAMITANDO';
  if (signatureDate) return 'ACEPTADO';
  return 'BORRADOR';
}

export async function updateContractDatesAction(
  contractId: string,
  dates: {
    signatureDate?: Date | null;
    requestDate?: Date | null;
    activationDate?: Date | null;
    terminationDate?: Date | null;
  },
  tramitationType?: string
) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { supplyPoint: true, product: true }
    });

    if (!contract) return { error: 'Contrato no encontrado' };

    const mergedSignature = dates.signatureDate !== undefined ? dates.signatureDate : contract.signatureDate;
    const mergedRequest = dates.requestDate !== undefined ? dates.requestDate : contract.requestDate;
    const mergedActivation = dates.activationDate !== undefined ? dates.activationDate : contract.activationDate;
    const mergedTermination = dates.terminationDate !== undefined ? dates.terminationDate : contract.terminationDate;

    const newStatus = getContractStatusFromDates(mergedSignature, mergedRequest, mergedActivation, mergedTermination);

    let permanenceStartDate = contract.permanenceStartDate;
    const mergedTramitationType = tramitationType !== undefined ? tramitationType : contract.tramitationType;

    // Lógica de inicio de permanencia si entra una fecha de activación y no había permanencia (o queremos sobreescribir)
    if (mergedActivation && mergedTramitationType) {
      const reqTypeUpper = mergedTramitationType.toUpperCase();
      if (
        (!reqTypeUpper.includes('M1') && !reqTypeUpper.includes('E1')) ||
        (reqTypeUpper === 'M1S')
      ) {
        permanenceStartDate = mergedActivation;
      }
    }

    // Calculamos expectedEndDate automáticamente si tenemos inicio de permanencia
    let expectedEndDate = contract.expectedEndDate;
    let duration = contract.duration || contract.product?.permanenceMonths || 12;

    if (permanenceStartDate) {
      const start = new Date(permanenceStartDate);
      start.setMonth(start.getMonth() + duration);
      start.setDate(start.getDate() - 1); // Restar 1 día para el fin real
      expectedEndDate = start;
    }

    // Actualizamos el contrato
    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: newStatus,
        signatureDate: mergedSignature,
        requestDate: mergedRequest,
        activationDate: mergedActivation,
        terminationDate: mergedTermination,
        tramitationType: mergedTramitationType,
        tipo: getTramitationCodes(mergedTramitationType).tipo,
        tipoC2: getTramitationCodes(mergedTramitationType).tipoC2,
        permanenceStartDate,
        expectedEndDate,
        duration,
      }
    });

    // =====================================
    // GENERACIÓN AUTOMÁTICA DE COMISIONES
    // =====================================
    if (newStatus === "ACTIVO" && contract.status !== "ACTIVO") {
      // 1. Buscamos el usuario y su canal
      const user = await prisma.user.findUnique({
        where: { id: contract.userId },
        include: { channel: true }
      });

      if (user?.channelId) {
        // 2. Comprobamos si ya existe la comisión
        const existingCommission = await prisma.commission.findUnique({
          where: { contractId: contract.id }
        });

        if (!existingCommission && contract.product) {
          // 3. Calculamos la comisión usando el tipo configurado en el Producto
          let amount = 0;
          const consumption = contract.supplyPoint?.annualConsumption ? contract.supplyPoint.annualConsumption : 5000;
          const channelPct = user.channel?.fixedCommissionPct || 0.65;

          if (contract.product.commissionType === "POWER_TIERS") {
            // Ejemplo de cálculo por tramos de potencia para 2.0
            // Usamos p1c (Potencia en P1) del SupplyPoint
            const power = contract.supplyPoint.p1c || 3.3;
            const tiers = contract.product.powerTiersCommission as Record<string, number> || { "0-5": 20, "5-10": 30 };
            
            if (power <= 5) amount = tiers["0-5"] || 20;
            else if (power <= 10) amount = tiers["5-10"] || 30;
            else amount = 40; // Default
            
            // Si el tramo ya es neto para el canal, o si hay que multiplicarlo por el % del canal
            // amount = amount * channelPct; (Dependerá de la regla de negocio)
          } else {
            // "MARGIN_PERCENTAGE" (Sobre margen)
            // Calculamos un margen bruto dummy (fee * consumo + feePotencia * potencia)
            const feeEnergy = contract.product.fee || 0.015;
            const power = contract.supplyPoint.p1c || 5;
            const feePower = 0.05; // 5 centimos de margen de potencia al dia (ejemplo)
            
            const marginEnergy = consumption * feeEnergy;
            const marginPower = power * feePower * 365;
            const grossMargin = marginEnergy + marginPower;
            
            amount = grossMargin * channelPct;
          }

          await prisma.commission.create({
            data: {
              contractId: contract.id,
              channelId: user.channelId,
              consumptionBasis: consumption,
              amount: amount,
              relativeAmount: amount / consumption,
              signatureDate: mergedSignature,
              activationDate: mergedActivation,
              status: "PENDIENTE"
            }
          });
        }
      }
    }

    // Si el estado es ACTIVO (o BAJA, implica que llegó a activarse), actualizamos el SupplyPoint
    if (newStatus === 'ACTIVO' || newStatus === 'BAJA') {
      const cData = contract.airtableData as any || {};
      const newTariff = contract.product?.tariff || contract.supplyPoint.tariff;

      await prisma.supplyPoint.update({
        where: { id: contract.supplyPointId },
        data: {
          clientId: contract.clientId,
          address: cData.direccion || contract.supplyPoint.address,
          city: cData.poblacion || contract.supplyPoint.city,
          postalCode: cData.cp || contract.supplyPoint.postalCode,
          province: cData.provincia || contract.supplyPoint.province,
          tariff: newTariff,
          cnae: cData.cnae || contract.supplyPoint.cnae,
          iban: contract.iban || cData.iban || contract.supplyPoint.iban,
          p1c: contract.p1c ?? contract.supplyPoint.p1c,
          p2c: contract.p2c ?? contract.supplyPoint.p2c,
          p3c: contract.p3c ?? contract.supplyPoint.p3c,
          p4c: contract.p4c ?? contract.supplyPoint.p4c,
          p5c: contract.p5c ?? contract.supplyPoint.p5c,
          p6c: contract.p6c ?? contract.supplyPoint.p6c,
        }
      });
    }

    // Si el contrato pasa a ACTIVO por primera vez y hay un anterior, le damos de BAJA
    if (newStatus === 'ACTIVO' && contract.status !== 'ACTIVO' && contract.previousContractId) {
      await prisma.contract.update({
        where: { id: contract.previousContractId },
        data: {
          status: 'BAJA',
          terminationDate: mergedActivation
        }
      });
    }

    revalidatePath('/contratos');
    revalidatePath(`/contratos/${contractId}`);

    return { success: true, contractId, newStatus };
  } catch (error: any) {
    console.error('Error updating contract dates:', error);
    return { error: error.message || 'Error desconocido' };
  }
}

export async function sendContractToDocuSignAction(contractId: string) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { 
        Lead: true,
        client: true,
        supplyPoint: true
      }
    });

    if (!contract) return { error: 'Contrato no encontrado' };
    if (!contract.pdfUrl) return { error: 'El contrato no tiene un PDF de borrador generado.' };
    
    // Obtener email y nombre
    const cData: any = typeof contract.airtableData === 'string' ? JSON.parse(contract.airtableData) : (contract.airtableData || {});
    
    // Extracción robusta de datos buscando en Lead, Client, SupplyPoint, y luego en el JSON cData
    // Prioridad 1: Lead (estado de negociación)
    // Prioridad 2: cData (JSON del Lead / Airtable)
    // Prioridad 3: Client / SupplyPoint (estado consolidado, pero podría ser antiguo)
    
    let signerEmail = contract.Lead?.email || cData.email || cData.contactEmail || contract.client?.contactEmail;
    let signerName = contract.Lead?.businessName || cData.businessName || contract.client?.businessName || 'Cliente';
    let signerPhone = contract.Lead?.phone || cData.phone || contract.client?.contactPhone || '';
    let nif = contract.Lead?.vatNumber || cData.nif || cData.cif || contract.client?.vatNumber || '';
    
    let cups = contract.Lead?.cups || cData.cups || contract.supplyPoint?.cups || '';
    let address = cData.direccionSuministro?.address || cData.direccionSuministro || cData.direccion || contract.supplyPoint?.address || '';
    let postalCode = cData.direccionSuministro?.postalCode || cData.cp || cData.sCp || contract.supplyPoint?.postalCode || '';
    let city = cData.direccionSuministro?.city || cData.poblacion || contract.supplyPoint?.city || '';
    let province = cData.direccionSuministro?.province || cData.provincia || contract.supplyPoint?.province || '';
    let iban = cData.iban || contract.iban || '';

    if (!signerEmail) return { error: 'El cliente no tiene un email registrado para enviar a DocuSign.' };

    // 1. Descargar el PDF desde Cloudflare R2
    const pdfResponse = await fetch(contract.pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Error al descargar el PDF desde R2. Status: ${pdfResponse.status}`);
    }
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    // Construir el emailBlurb con los datos EXACTOS del sistema antiguo
    const introMessage = "UNA VEZ LEÍDO TODO EL DOCUMENTO, PULSE EN CUALQUIER PARTE DEL MISMO, AGREGUE SU FIRMA Y PULSE EN FINALIZAR. NO ES NECESARIO REALIZAR NINGÚN OTRO PASO NI AÑADIR INFORMACIÓN ADICIONAL.";
    const dataMessage = `Por favor, compruebe los datos de su solicitud antes de proceder con la firma. Titular: ${signerName}. identificador: ${nif}. Dirección del punto de suministro: ${address} CP: ${postalCode} Población/Municipio: ${city} Provincia: ${province}. CUPS (en factura): ${cups}. IBAN: ${iban}. Tlfn. Contacto: ${signerPhone}. E-Mail Contacto: ${signerEmail}.`;
    const emailBlurb = `${introMessage} ${dataMessage}`;
    
    // Título del sobre exacto al sistema antiguo (Código de contrato / Contrato de suministro eléctrico)
    const emailSubject = `${contract.contractCode || contract.Lead?.airtableId || contractId} / Contrato de suministro eléctrico`;

    // 2. Enviar a DocuSign (ahora con soporte para SMS multi-canal)
    const envelopeId = await createAndSendEnvelope(
      contractId,
      pdfBuffer,
      signerName,
      signerEmail,
      emailSubject,
      emailBlurb,
      signerPhone // Pasamos el teléfono resuelto (Lead, cData or Client)
    );

    // 3. Guardar el envelopeId
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        docusignEnvelopeId: envelopeId
      }
    });
    
    return { success: true, message: 'Contrato enviado a firma exitosamente.' };
  } catch (error: any) {
    console.error('Error sending contract to DocuSign:', error);
    return { error: error.message || 'Error desconocido al enviar a DocuSign' };
  }
}


export async function createContractModificationAction(contractId: string, type: string, changes: any) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    });

    if (!contract) return { error: 'Contrato no encontrado' };

    // Para M1N (técnica) u otras, creamos un registro de modificación
    const mod = await prisma.contractModification.create({
      data: {
        contractId: contractId,
        type: type,
        status: 'PENDIENTE',
        requestedChanges: changes
      }
    });

    // TODO: Si es M1S, podríamos clonar el contrato y generar el Anexo.

    return { success: true, message: 'Modificación solicitada correctamente.', modificationId: mod.id };
  } catch (error: any) {
    console.error('Error creating modification:', error);
    return { error: error.message || 'Error desconocido al solicitar modificación' };
  }
}

export async function updateContractFull(formData: FormData) {
  try {
    const contractId = formData.get('contractId') as string;
    if (!contractId) throw new Error('Contract ID missing');

    const status = formData.get('status') as string;
    const internalComments = formData.get('internalComments') as string;
    const signatureDate = formData.get('signatureDate') as string;
    const requestDate = formData.get('requestDate') as string;
    const activationDate = formData.get('activationDate') as string;
    const terminationDate = formData.get('terminationDate') as string;
    const permanenceStartDate = formData.get('permanenceStartDate') as string;
    const expectedEndDate = formData.get('expectedEndDate') as string;
    const discountStartDate = formData.get('discountStartDate') as string;
    const discountEndDate = formData.get('discountEndDate') as string;
    const svaStartDate = formData.get('svaStartDate') as string;
    
    const tramitationType = formData.get('tramitationType') as string;
    const tipo = formData.get('tipo') as string;
    const tipoC2 = formData.get('tipoC2') as string;
    const distributorMsg = formData.get('distributorMsg') as string;
    const svaConcept = formData.get('svaConcept') as string;

    const duration = formData.get('duration') ? parseInt(formData.get('duration') as string) : undefined;
    const svaDuration = formData.get('svaDuration') ? parseInt(formData.get('svaDuration') as string) : undefined;

    const parseF = (val: FormDataEntryValue | null) => val && val !== '' ? parseFloat(val as string) : undefined;
    const commissionBase = parseF(formData.get('commissionBase'));
    const commissionFinal = parseF(formData.get('commissionFinal'));
    const commissionVariable = parseF(formData.get('commissionVariable'));
    const penalization = parseF(formData.get('penalization'));
    const svaPrice = parseF(formData.get('svaPrice'));
    const fee = parseF(formData.get('fee'));
    const pexc = parseF(formData.get('pexc'));
    const cgBolsilloSolar = parseF(formData.get('cgBolsilloSolar'));
    const deviationCost = parseF(formData.get('deviationCost'));
    const discountPrice = parseF(formData.get('discountPrice'));
    
    const p1e = parseF(formData.get('p1e')); const p2e = parseF(formData.get('p2e')); const p3e = parseF(formData.get('p3e'));
    const p4e = parseF(formData.get('p4e')); const p5e = parseF(formData.get('p5e')); const p6e = parseF(formData.get('p6e'));
    const p1p = parseF(formData.get('p1p')); const p2p = parseF(formData.get('p2p')); const p3p = parseF(formData.get('p3p'));
    const p4p = parseF(formData.get('p4p')); const p5p = parseF(formData.get('p5p')); const p6p = parseF(formData.get('p6p'));
    const p1c = parseF(formData.get('p1c')); const p2c = parseF(formData.get('p2c')); const p3c = parseF(formData.get('p3c'));
    const p4c = parseF(formData.get('p4c')); const p5c = parseF(formData.get('p5c')); const p6c = parseF(formData.get('p6c'));

    const distributor = formData.get('distributor') as string;
    const annualConsumptionStr = formData.get('annualConsumption') as string;
    const vatNumber = formData.get('vatNumber') as string;
    const contactEmail = formData.get('contactEmail') as string;
    const invoiceEmail = formData.get('invoiceEmail') as string;
    const contactPhone = formData.get('contactPhone') as string;
    const iban = formData.get('iban') as string;
    const cnae = formData.get('cnae') as string;
    const tariff = formData.get('tariff') as string;

    const file = formData.get('signedContractPdf') as File | null;
    const anexoFile = formData.get('signedAnexoPdf') as File | null;

    let filePdfSignedUrl: string | undefined = undefined;
    let fileAnexoFirmadoUrl: string | undefined = undefined;

    // First fetch the existing contract to get client and supply point IDs
    const existing = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { client: true, supplyPoint: true }
    });

    if (!existing) throw new Error('Contract not found');

    // Handle file upload
    if (file && file.size > 0) {
      const { uploadFileToR2 } = await import('@/lib/r2');
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const url = await uploadFileToR2(`contracts/${contractId}/${file.name}`, buffer, file.type || 'application/pdf');
      filePdfSignedUrl = url;

      // Save it as a Document related to Contract
      await prisma.document.create({
        data: {
          type: 'Contrato',
          url: url,
          name: file.name,
          contractId: contractId
        }
      });
    }

    if (anexoFile && anexoFile.size > 0) {
      const { uploadFileToR2 } = await import('@/lib/r2');
      const arrayBuffer = await anexoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const url = await uploadFileToR2(`contracts/${contractId}/anexo_${anexoFile.name}`, buffer, anexoFile.type || 'application/pdf');
      fileAnexoFirmadoUrl = url;

      await prisma.document.create({
        data: {
          type: 'Anexo',
          url: url,
          name: anexoFile.name,
          contractId: contractId
        }
      });
    }

    // Determine if we should update SupplyPoint or Contract with IBAN
    const newStatus = status || existing.status;
    const isActivo = newStatus === 'ACTIVO';

    // Contract data is a snapshot. We no longer update Client or SupplyPoint from here.
    // Update Contract
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: status || undefined,
        iban: iban || undefined,
        internalComments: internalComments,
        signatureDate: signatureDate ? new Date(signatureDate) : null,
        requestDate: requestDate ? new Date(requestDate) : null,
        activationDate: activationDate ? new Date(activationDate) : null,
        terminationDate: terminationDate ? new Date(terminationDate) : null,
        permanenceStartDate: permanenceStartDate ? new Date(permanenceStartDate) : null,
        expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
        discountStartDate: discountStartDate ? new Date(discountStartDate) : null,
        discountEndDate: discountEndDate ? new Date(discountEndDate) : null,
        svaStartDate: svaStartDate ? new Date(svaStartDate) : null,
        tramitationType: tramitationType || undefined,
        tipo: tipo || (tramitationType ? getTramitationCodes(tramitationType).tipo : undefined),
        tipoC2: tipoC2 || (tramitationType ? getTramitationCodes(tramitationType).tipoC2 : undefined),
        distributorMsg: distributorMsg,
        svaConcept: svaConcept,
        duration: duration,
        svaDuration: svaDuration,
        commissionBase, commissionFinal, commissionVariable,
        penalization, svaPrice, fee, pexc, cgBolsilloSolar, deviationCost, discountPrice,
        p1e, p2e, p3e, p4e, p5e, p6e,
        p1p, p2p, p3p, p4p, p5p, p6p,
        p1c, p2c, p3c, p4c, p5c, p6c,
        filePdfSigned: filePdfSignedUrl || undefined,
        fileAnexoFirmado: fileAnexoFirmadoUrl || undefined,
      }
    });

    revalidatePath('/contratos');
    return { success: true };
  } catch (error: any) {
    console.error('Error in updateContractFull:', error);
    return { error: error.message || 'Error updating contract' };
  }
}

export async function getPaginatedContractsAction(
  page: number, 
  limit: number, 
  searchTerm: string, 
  estadoFilter: string,
  tarifaFilter: string,
  canalFilter: string,
  sortCol: string | null,
  sortDir: 'asc' | 'desc'
) {
  try {
    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    let whereClause: any = { ...visibilityFilter };

    if (searchTerm) {
      const terms = searchTerm.split(/\s+/).filter(Boolean);
      
      const searchConditions = terms.map(term => ({
        OR: [
          { contractCode: { contains: term, mode: 'insensitive' } },
          { supplyPoint: { cups: { contains: term, mode: 'insensitive' } } },
          { client: { businessName: { contains: term, mode: 'insensitive' } } },
          { client: { firstName: { contains: term, mode: 'insensitive' } } },
          { client: { lastName: { contains: term, mode: 'insensitive' } } },
          { product: { name: { contains: term, mode: 'insensitive' } } }
        ]
      }));

      if (whereClause.AND) {
        if (Array.isArray(whereClause.AND)) {
          whereClause.AND = [...whereClause.AND, ...searchConditions];
        } else {
          whereClause.AND = [whereClause.AND, ...searchConditions];
        }
      } else {
        whereClause.AND = searchConditions;
      }
    }

    if (estadoFilter && estadoFilter !== 'Todos') {
      whereClause.status = estadoFilter;
    }

    if (tarifaFilter && tarifaFilter !== 'Todas') {
      whereClause.supplyPoint = {
        ...whereClause.supplyPoint,
        tariff: tarifaFilter
      };
    }

    if (canalFilter && canalFilter !== 'Todos') {
      whereClause.user = {
        ...whereClause.user,
        channel: {
          name: canalFilter
        }
      };
    }

    let orderBy: any = undefined;
    if (sortCol) {
      if (sortCol === 'fechaRegistro') orderBy = { createdAt: sortDir };
      else if (sortCol === 'fechaAlta') orderBy = { activationDate: sortDir };
      else if (sortCol === 'estado') orderBy = { status: sortDir };
      else if (sortCol === 'cups') orderBy = { supplyPoint: { cups: sortDir } };
      else if (sortCol === 'cliente') orderBy = { client: { businessName: sortDir } };
      else if (sortCol === 'producto') orderBy = { product: { name: sortDir } };
      else if (sortCol === 'consumoMwh') orderBy = { supplyPoint: { annualConsumption: sortDir } };
      // Fallback
      else orderBy = { createdAt: 'desc' };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    let orderByParams: any[] = [];
    if (orderBy) {
      if (Array.isArray(orderBy)) {
        orderByParams = [...orderBy];
      } else {
        orderByParams = [orderBy];
      }
    }
    orderByParams.push({ version: 'desc' });

    // Fetch all matching IDs and contract codes to deduplicate in memory
    // This allows us to keep the complex filtering/sorting from Prisma
    const allMatching = await prisma.contract.findMany({
      where: whereClause,
      select: { id: true, contractCode: true, status: true, supplyPointId: true, activationDate: true, terminationDate: true },
      orderBy: orderByParams
    });

    // Filtramos FALSAS BAJAS (Lógica del Dashboard: si hay otro contrato dentro de 30 días de gracia, no es baja)
    const bajaContracts = allMatching.filter(c => c.status === 'BAJA' && c.supplyPointId);
    const falseBajaIds = new Set<string>();

    if (bajaContracts.length > 0) {
      const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
      const bajaSupplyPointIds = [...new Set(bajaContracts.map(c => c.supplyPointId))];

      const siblingContracts = await prisma.contract.findMany({
        where: { supplyPointId: { in: bajaSupplyPointIds as string[] } },
        select: { id: true, supplyPointId: true, activationDate: true, terminationDate: true }
      });

      const contractsByCups: Record<string, typeof siblingContracts> = {};
      for (const c of siblingContracts) {
        if (!contractsByCups[c.supplyPointId!]) contractsByCups[c.supplyPointId!] = [];
        contractsByCups[c.supplyPointId!].push(c);
      }

      for (const baja of bajaContracts) {
        if (!baja.terminationDate) continue;

        const siblings = contractsByCups[baja.supplyPointId!] || [];
        const bajaTermTime = baja.terminationDate.getTime();
        const bajaActTime = baja.activationDate ? baja.activationDate.getTime() : 0;

        let isFalseBaja = false;
        for (const sibling of siblings) {
          if (sibling.id === baja.id) continue;
          if (!sibling.activationDate) continue;

          const siblingActTime = sibling.activationDate.getTime();
          // Es falsa baja si un contrato hermano se activa después o igual, y antes del fin del periodo de gracia
          if (siblingActTime >= bajaActTime && siblingActTime <= bajaTermTime + GRACE_PERIOD_MS) {
            isFalseBaja = true;
            break;
          }
        }

        if (isFalseBaja) {
          falseBajaIds.add(baja.id);
        }
      }
    }

    const seenCodes = new Set<string>();
    const deduplicatedIds: string[] = [];

    for (const item of allMatching) {
      if (falseBajaIds.has(item.id)) continue; // Omitir las falsas bajas de la tabla
      
      if (item.contractCode) {
        if (!seenCodes.has(item.contractCode)) {
          seenCodes.add(item.contractCode);
          deduplicatedIds.push(item.id);
        }
      } else {
        deduplicatedIds.push(item.id);
      }
    }

    const totalCount = deduplicatedIds.length;
    const offset = (page - 1) * limit;
    const pageIds = deduplicatedIds.slice(offset, offset + limit);

    const contracts = await prisma.contract.findMany({
      where: { id: { in: pageIds } },
      include: {
        Lead: true,
        product: { select: { name: true } },
        user: { select: { name: true, email: true, channel: { select: { name: true } } } },
        client: true,
        supplyPoint: true
      },
    });

    // Ensure we preserve the original requested order
    contracts.sort((a, b) => pageIds.indexOf(a.id) - pageIds.indexOf(b.id));

    const uiContracts = contracts.map(c => {
      const airtableData = (c.airtableData as any) || {};
      
      let signedUrl = c.filePdfSigned || null;
      if (!signedUrl && airtableData['PDF Contrato firmado'] && Array.isArray(airtableData['PDF Contrato firmado']) && airtableData['PDF Contrato firmado'].length > 0) {
        signedUrl = airtableData['PDF Contrato firmado'][0].url;
      } else if (!signedUrl && airtableData['Contrato .PDF'] && Array.isArray(airtableData['Contrato .PDF']) && airtableData['Contrato .PDF'].length > 0) {
        signedUrl = airtableData['Contrato .PDF'][0].url;
      }

      let draftUrl = c.pdfUrl || null;
      if (!draftUrl && airtableData['Borrador contrato'] && Array.isArray(airtableData['Borrador contrato']) && airtableData['Borrador contrato'].length > 0) {
        draftUrl = airtableData['Borrador contrato'][0].url;
      }

      let annexUrl = c.fileAnexoFirmado || null;
      if (!annexUrl && airtableData['PDF Anexo firmado'] && Array.isArray(airtableData['PDF Anexo firmado']) && airtableData['PDF Anexo firmado'].length > 0) {
        annexUrl = airtableData['PDF Anexo firmado'][0].url;
      }
      return {
        ...c,
        lead: c.Lead,
        client: c.client,
        supplyPoint: c.supplyPoint,
        user: c.user,
        product: c.product,
        signedUrl,
        draftUrl,
        annexUrl
      };
    });

    return { success: true, contracts: uiContracts, totalCount };
  } catch (error: any) {
    console.error("Error fetching paginated contracts:", error);
    return { success: false, error: error.message };
  }
}

export async function getContractVersionsAction(contractCode: string) {
  try {
    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    const versions = await prisma.contract.findMany({
      where: { 
        ...visibilityFilter,
        contractCode 
      },
      select: {
        id: true,
        version: true,
        createdAt: true,
        status: true
      },
      orderBy: { version: 'desc' }
    });

    return { success: true, versions };
  } catch (error: any) {
    console.error("Error fetching contract versions:", error);
    return { success: false, error: error.message };
  }
}

export async function getContractStatsAction() {
  try {
    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    const activos = await prisma.contract.count({
      where: { ...visibilityFilter, status: 'ACTIVO' }
    });

    const tramitando = await prisma.contract.count({
      where: { ...visibilityFilter, status: 'TRAMITANDO' }
    });

    // Bajas: Net Bajas logic
    const contracts = await prisma.contract.findMany({
      where: {
        ...visibilityFilter,
        status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] }
      },
      select: {
        id: true,
        activationDate: true,
        terminationDate: true,
        supplyPointId: true
      }
    });

    const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
    const contractsByCups: Record<string, typeof contracts> = {};
    contracts.forEach(c => {
      if (!c.supplyPointId || !c.activationDate) return;
      if (!contractsByCups[c.supplyPointId]) contractsByCups[c.supplyPointId] = [];
      contractsByCups[c.supplyPointId].push(c);
    });

    let netBajasCount = 0;
    Object.values(contractsByCups).forEach(cupsContracts => {
      cupsContracts.sort((a, b) => a.activationDate!.getTime() - b.activationDate!.getTime());
      let currentPeriod: { end: Date | null } | null = null;
      let localNetBajas = 0;
      for (const c of cupsContracts) {
        if (!currentPeriod) {
          currentPeriod = { end: c.terminationDate || null };
          continue;
        }
        const startNext = c.activationDate!;
        if (currentPeriod.end === null) {
          // Open period
        } else {
          if (startNext.getTime() <= currentPeriod.end.getTime() + GRACE_PERIOD_MS) {
            if (!c.terminationDate) {
              currentPeriod.end = null;
            } else if (c.terminationDate.getTime() > currentPeriod.end.getTime()) {
              currentPeriod.end = c.terminationDate;
            }
          } else {
            localNetBajas++;
            currentPeriod = { end: c.terminationDate || null };
          }
        }
      }
      if (currentPeriod && currentPeriod.end !== null) {
        localNetBajas++;
      }
      netBajasCount += localNetBajas;
    });

    const bajas = netBajasCount;

    // MWh: Solamente de contratos activos (misma cartera viva que dashboard)
    const activeContracts = await prisma.contract.findMany({
      where: { ...visibilityFilter, status: 'ACTIVO' },
      select: { supplyPoint: { select: { annualConsumption: true } } }
    });
    
    let totalMwh = 0;
    activeContracts.forEach(c => {
      totalMwh += c.supplyPoint?.annualConsumption || 0;
    });

    return { success: true, activos, tramitando, bajas, totalMwh };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getFullContractAction(id: string) {
  try {
    const { prisma } = await import('@/lib/prisma');
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        Lead: true,
        product: true,
        user: { include: { channel: true } },
        client: true,
        supplyPoint: true
      }
    });
    if (!contract) return { success: false, error: 'No encontrado' };
    return { success: true, contract };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
