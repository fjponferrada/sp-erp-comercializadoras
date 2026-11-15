'use server';

import { prisma } from '@/lib/prisma';
import { findOrUpdateSupplyPointByCups } from '@/lib/supplyPointHelper';
import { normalizeSpanishPostalCode, normalizeSpanishPostalCodeOrNull } from '@/lib/postalCode';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { buildTemplateDataFromLead, getSupplyAddress, getTitularAddress } from '@/lib/templateBuilder';
import { getTramitationCodes } from '@/lib/tramitationMapper';
import {
  calculateAndSnapshotContractCommission,
  extractContractMarginSnapshots,
} from '@/lib/services/CommissionEngine';

export async function convertLeadToContractAction(leadId: string): Promise<{
  success?: boolean;
  contractId?: string;
  pdfWarning?: string;
  error?: string;
  validationErrors?: string[];
}> {
  try {
    // 1. Verificar si ya existe un contrato para este Lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { contract: true, documents: true, user: { include: { brand: true } } },
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
    const brandIdToUse = lead.user?.brandId || (await prisma.brand.findFirst())?.id || '';

    // 1. SIPS OK
    if (
      !lead.sipsOk &&
      lead.sipsMessages &&
      lead.sipsMessages.length > 0 &&
      lead.sipsMessages !== 'SIPS Refrescado Correctamente' &&
      lead.sipsMessages !== 'Validado correctamente contra SIPS'
    ) {
      validationErrors.push(`Aviso de SIPS pendiente de revisión: ${lead.sipsMessages}`);
    }

    // 2. Error NIF apoderado/titular
    const vat = (lead.vatNumber || cData.nif || '').trim().toUpperCase();
    if (!vat || !/^[A-Z0-9]{8,9}$/i.test(vat.replace(/[-\s]/g, ''))) {
      validationErrors.push("El NIF/CIF del titular está vacío o no tiene un formato válido.");
    }

    // 2.5 Validación de Apoderado para Personas Jurídicas (Regla 75)
    const cleanVat = vat.replace(/[-\s]/g, '');
    const isJuridica = /^[A-W]/i.test(cleanVat) && !/^[XYZ]/i.test(cleanVat);
    const apoderadoNombre = String(cData.contactoNombre || cData.representativeName || '').trim();
    const apoderadoApellidos = String(cData.contactoApellidos || cData.representativeLastName || '').trim();
    const apoderadoNif = String(cData.contactoNif || cData.representativeVat || '').trim().toUpperCase();

    if (isJuridica) {
      if (!apoderadoNombre || !apoderadoApellidos || !apoderadoNif) {
        validationErrors.push("Para personas jurídicas (empresas o comunidades), es obligatorio rellenar los datos del Apoderado (Nombre, Apellidos y NIF).");
      }
    }

    // 3. Error CP Titular y Suministro
    const cpTitular = normalizeSpanishPostalCodeOrNull(cData.cp || cData.codigoPostal || cData.direccion?.cp);
    if (cpTitular && !/^\d{5}$/.test(cpTitular)) {
      validationErrors.push("El Código Postal del Titular debe tener 5 dígitos.");
    }
    const cpSuministro = normalizeSpanishPostalCodeOrNull(
      cData.sCp || cData.direccionSuministro?.cp || cData.direccionSuministro?.postalCode || cData.direccion?.cp || cpTitular
    );
    if (!cpSuministro || !/^\d{5}$/.test(cpSuministro)) {
      validationErrors.push("El Código Postal del Punto de Suministro debe tener 5 dígitos.");
    }

    // 4. Tarifa / Consumo (SIPS Jerarquía)
    let finalConsumptionMWh = lead.estimatedMWh || 0;
    const sRaw: any = lead.sipsRawData || {};
    const sipsPs: any = sRaw?.data?.ps?.[0] || {};
    const sipsConsumoKWh = Number(sRaw.consumo || sRaw.Consumo || sRaw.annualConsumption || sipsPs.ConsumoAnualkWh || 0);
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
    let resolvedSipsPostalCode: string | null = null;
    let resolvedSipsCnae: string | null = null;
    let resolvedSipsTariff: string | null = null;

    if (lead.cups) {
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

      // Fallback a lead.sipsRawData y sipsPs
      if (!sipsPostalCode && (sRaw.postalCode || sRaw.codigoPostal || sRaw.cp || sipsPs.CódigoPostalPS)) {
         sipsPostalCode = String(sRaw.postalCode || sRaw.codigoPostal || sRaw.cp || sipsPs.CódigoPostalPS);
      }
      if (!sipsCnae && (sRaw.cnae || sipsPs.CNAE)) sipsCnae = String(sRaw.cnae || sipsPs.CNAE);
      if (!sipsTariff && (sRaw.tariff || sRaw.tarifa || sipsPs.TarifaATR)) sipsTariff = String(sRaw.tariff || sRaw.tarifa || sipsPs.TarifaATR);
      
      for (let i = 1; i <= 6; i++) {
         if (sipsP[i - 1] === null) {
            const rawP = sRaw[`p${i}`] ?? sRaw[`p${i}c`] ?? sipsPs[`PotenciaContratadaP${i}kW`];
            if (rawP !== undefined && rawP !== null && rawP !== '') {
                sipsP[i - 1] = parseFloat(String(rawP).replace(',', '.'));
            }
         }
      }

      sipsPostalCode = normalizeSpanishPostalCodeOrNull(sipsPostalCode);
      resolvedSipsPostalCode = sipsPostalCode;
      resolvedSipsCnae = sipsCnae;
      resolvedSipsTariff = sipsTariff;

      if (sipsPostalCode && cpSuministro && sipsPostalCode !== cpSuministro) {
        validationErrors.push(`El Código Postal introducido (${cpSuministro}) no coincide con el del SIPS (${sipsPostalCode}).`);
      }
      if (sipsCnae && cData.cnae && String(sipsCnae).trim() !== String(cData.cnae).trim()) {
        validationErrors.push(`El CNAE introducido (${cData.cnae}) no coincide con el del SIPS (${sipsCnae}).`);
      }

      // 6. Validar Potencias y Tarifa si no hay cambios técnicos (Regla 74)
      const tramitacion = cData.tipoTramitacion || cData.tramitationType || '';
      const requiereVerificacionTecnica = [
        'Cambio comercializadora sin cambios',
        'Cambio comercializadora con cambios administrativos',
        'Modificación de datos administrativos'
      ].includes(tramitacion);

      if (requiereVerificacionTecnica) {
        if (sipsTariff && lead.tariff && sipsTariff !== lead.tariff) {
          validationErrors.push(`La tarifa solicitada (${lead.tariff}) no coincide con la del SIPS (${sipsTariff}) para este tipo de tramitación.`);
        }
        const periodsToCheck = (lead.tariff || '2.0TD') === '2.0TD' ? [1, 2] : [1, 2, 3, 4, 5, 6];
        for (const i of periodsToCheck) {
          const reqPStr = cData.potencias?.[`p${i}`] ?? cData[`p${i}c`] ?? cData[`p${i}`];
          const reqP = parseFloat(String(reqPStr ?? '').replace(',', '.'));
          const sP = sipsP[i - 1];
          if (!isNaN(reqP) && sP !== null && sP !== undefined && !isNaN(sP)) {
             if (Math.abs(reqP - sP) > 0.01) {
                validationErrors.push(`La potencia P${i} solicitada (${reqP} kW) no coincide con la del SIPS (${sP} kW). Selecciona un trámite 'con cambios técnicos' si deseas alterarla.`);
             }
          }
        }
      }
    }

    // 7. Validar congruencia de Tarifa del Producto (Regla 73)
    if (lead.product) {
      let p = null;
      if (lead.product.startsWith('cm')) {
        p = await prisma.product.findUnique({ where: { id: lead.product } });
      } else {
        p =
          (await prisma.product.findFirst({ where: { name: lead.product.trim(), brandId: brandIdToUse } })) ||
          (await prisma.product.findFirst({ where: { name: lead.product.trim() } }));
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

    const wantsPaperInvoice =
      cData.envioFactura === 'Postal' ||
      cData.envioFactura === 'Ambos' ||
      cData.facturasPapel === 'SI' ||
      cData.facturasPapel === 'Si';
    const titularBillingAddr = getTitularAddress(cData) || null;
    const titularCity = cData.direccion?.poblacion || cData.poblacion || null;
    const titularProvince = cData.direccion?.provincia || cData.provincia || null;
    const indivFirstName = !isJuridica
      ? String(cData.nombre || '').trim() || undefined
      : undefined;
    const indivLastName1 = !isJuridica ? String(cData.primerApellido || '').trim() || undefined : undefined;
    const indivLastName2 = !isJuridica ? String(cData.segundoApellido || '').trim() || undefined : undefined;
    const repFullName = isJuridica ? `${apoderadoNombre} ${apoderadoApellidos}`.trim() || undefined : undefined;

    // 2. Necesitamos un Client. Buscamos por NIF o creamos.
    const vatNum = vat || `PENDING-${lead.id}`;
    let client = await prisma.client.findUnique({
      where: { vatNumber_brandId: { vatNumber: vatNum, brandId: brandIdToUse } }
    });
    
    if (client) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          businessName: lead.businessName,
          ...(indivFirstName ? { firstName: indivFirstName } : {}),
          ...(indivLastName1 ? { lastName: indivLastName1 } : {}),
          ...(indivLastName2 ? { lastName2: indivLastName2 } : {}),
          ...(repFullName ? { representativeName: repFullName } : {}),
          ...(isJuridica && apoderadoNif ? { representativeVat: apoderadoNif } : {}),
          ...(isJuridica && apoderadoNombre ? { contactName: apoderadoNombre } : {}),
          ...(isJuridica && apoderadoApellidos ? { contactLastName: apoderadoApellidos } : {}),
          ...(isJuridica && apoderadoNif ? { contactVat: apoderadoNif } : {}),
          ...(cData.cnae ? { cnae: String(cData.cnae) } : {}),
          paperInvoice: wantsPaperInvoice,
          ...(titularBillingAddr ? { billingAddress: titularBillingAddr } : {}),
          ...(cpTitular ? { billingPostalCode: cpTitular } : {}),
          ...(titularCity ? { billingCity: titularCity } : {}),
          ...(titularProvince ? { billingProvince: titularProvince } : {}),
          contactEmail: contactEmail || client.contactEmail,
          contactEmail2: contactEmail2 || client.contactEmail2,
          contactEmail3: contactEmail3 || client.contactEmail3,
          contactPhone: lead.phone || client.contactPhone,
          clientType: cData.tipoCliente || (isJuridica ? 'Empresa' : 'Persona física'),
          isMultipoint: isMultipoint || client.isMultipoint,
        }
      });
    } else {
      client = await prisma.client.create({
        data: {
          businessName: lead.businessName,
          firstName: indivFirstName || '',
          lastName: indivLastName1 || '',
          lastName2: indivLastName2 || null,
          representativeName: repFullName || null,
          representativeVat: isJuridica && apoderadoNif ? apoderadoNif : null,
          contactName: isJuridica && apoderadoNombre ? apoderadoNombre : null,
          contactLastName: isJuridica && apoderadoApellidos ? apoderadoApellidos : null,
          contactVat: isJuridica && apoderadoNif ? apoderadoNif : null,
          cnae: cData.cnae ? String(cData.cnae) : null,
          paperInvoice: wantsPaperInvoice,
          billingAddress: titularBillingAddr,
          billingPostalCode: cpTitular,
          billingCity: titularCity,
          billingProvince: titularProvince,
          vatNumber: vatNum,
          contactEmail: contactEmail,
          contactEmail2: contactEmail2,
          contactEmail3: contactEmail3,
          contactPhone: lead.phone,
          clientType: cData.tipoCliente || (isJuridica ? 'Empresa' : 'Persona física'),
          brandId: brandIdToUse,
          isMultipoint: isMultipoint,
        }
      });
    }

    const hasAutoconsumo =
      cData.autoconsumo === 'SI' ||
      cData.autoconsumo === 'Sí' ||
      cData.autoconsumo === 'Si' ||
      cData.autoconsumo === true;
    const hasBolsilloSolar =
      hasAutoconsumo &&
      (cData.bolsilloSolar === 'SI' ||
        cData.bolsilloSolar === 'Sí' ||
        cData.bolsilloSolar === 'Si' ||
        cData.bolsilloSolar === true);
    const isTransferencia = String(cData.formaPago || '').toLowerCase().includes('transferencia');

    // 3. Necesitamos un SupplyPoint. Buscamos por CUPS + clientId (Regla 72).
    const targetCups = (lead.cups || `CUPS-PENDING-${lead.id}`).trim().toUpperCase();
    const supplyPoint = await findOrUpdateSupplyPointByCups(prisma, targetCups, client.id, {
      address: getSupplyAddress(cData) || titularBillingAddr || 'Pendiente',
      city: cData.direccionSuministro?.poblacion || cData.sPoblacion || cData.poblacion || cData['Población Instalación'] || 'Pendiente',
      postalCode: cpSuministro || cData.sCp || cData.cp || cData['Código Postal Instalación'] || '00000',
      province: cData.direccionSuministro?.provincia || cData.sProvincia || cData.provincia || cData['Provincia Instalación'] || 'Pendiente',
      tariff: lead.tariff || '2.0TD',
      cnae: cData.cnae ? String(cData.cnae) : null,
      annualConsumption: finalConsumptionMWh > 0 ? finalConsumptionMWh : null,
      p1c: parseFloat(cData.potencias?.p1 || cData.p1c || cData.p1) || null,
      p2c: parseFloat(cData.potencias?.p2 || cData.p2c || cData.p2) || null,
      p3c: parseFloat(cData.potencias?.p3 || cData.p3c || cData.p3) || null,
      p4c: parseFloat(cData.potencias?.p4 || cData.p4c || cData.p4) || null,
      p5c: parseFloat(cData.potencias?.p5 || cData.p5c || cData.p5) || null,
      p6c: parseFloat(cData.potencias?.p6 || cData.p6c || cData.p6) || null,
      iban: cData.iban || null,
      paymentMethod: cData.formaPago || null,
      hasSelfConsumption: hasAutoconsumo,
      sipsPostalCode: resolvedSipsPostalCode,
      sipsCnae: resolvedSipsCnae,
      sipsTariff: resolvedSipsTariff,
    });

    let previousContractId: string | null = null;
    if (supplyPoint?.contracts && supplyPoint.contracts.length > 0) {
      const candidatePrevId = supplyPoint.contracts[0].id;
      const alreadyLinked = await prisma.contract.findUnique({
        where: { previousContractId: candidatePrevId },
        select: { id: true },
      });
      if (!alreadyLinked) {
        previousContractId = candidatePrevId;
      }
    }

    // 4. Necesitamos un Product de la marca activa (con fallback).
    let product = null;
    if (lead.product && lead.product.startsWith('cm')) {
      product = await prisma.product.findUnique({ where: { id: lead.product } });
    } else {
      const pName = (lead.product || 'Producto Genérico').trim();
      product =
        (await prisma.product.findFirst({ where: { name: pName, brandId: brandIdToUse } })) ||
        (await prisma.product.findFirst({ where: { name: pName } }));
    }

    if (!product) {
      if (!brandIdToUse) throw new Error("No hay marcas configuradas en el sistema.");
      product = await prisma.product.create({
        data: {
          name: (lead.product || 'Producto Genérico').trim(),
          type: lead.productType || 'FIX',
          brandId: brandIdToUse,
          tariff: lead.tariff || '2.0TD',
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
    
    const isCompany = isJuridica || client.vatNumber.toUpperCase().startsWith('A') || client.vatNumber.toUpperCase().startsWith('B');
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

    let additionalServicesSnapshot = null;
    let additionalServiceConnect = undefined;
    if (cData.additionalServiceIds && Array.isArray(cData.additionalServiceIds) && cData.additionalServiceIds.length > 0) {
      const services = await prisma.additionalService.findMany({
        where: { id: { in: cData.additionalServiceIds } }
      });
      additionalServicesSnapshot = services.map(s => ({
        id: s.id,
        name: s.name,
        monthlyPrice: s.monthlyPrice,
        dailyPrice: s.dailyPrice,
        durationMonths: s.durationMonths,
        isCommissionable: s.isCommissionable
      }));
      additionalServiceConnect = { connect: services.map(s => ({ id: s.id })) };
    }
    
    // Rellenar legacy fields para retrocompatibilidad UI y facturación si hay servicios adicionales
    let svaConceptToSave = cData.servicioAdicional || (product as any).svaConcept || undefined;
    let svaPriceToSave = undefined;
    let svaDurationToSave = undefined;
    if (additionalServicesSnapshot && additionalServicesSnapshot.length > 0) {
      const firstService = additionalServicesSnapshot[0];
      svaConceptToSave = firstService.name;
      svaDurationToSave = firstService.durationMonths;
      
      // El motor de facturación requiere el precio TOTAL del servicio para prorratearlo
      if (firstService.monthlyPrice !== null && firstService.monthlyPrice !== undefined) {
        svaPriceToSave = firstService.monthlyPrice * (firstService.durationMonths || 120);
      } else if (firstService.dailyPrice !== null && firstService.dailyPrice !== undefined) {
        svaPriceToSave = firstService.dailyPrice * 30 * (firstService.durationMonths || 120);
      }
    }

    // 5. Crear el contrato con snapshots inmutables de márgenes y auto-cálculo de comisión
    const marginSnap = extractContractMarginSnapshots(cData, product, lead.productType);
    const tramName = cData.tipoTramitacion || cData.tramitationType || 'Cambio comercializadora sin cambios';

    const contract = await prisma.contract.create({
      data: {
        userId: lead.userId,
        brandId: lead.user?.brandId || product.brandId || null,
        clientId: client.id,
        supplyPointId: supplyPoint.id,
        productId: product.id,
        status: isMultipoint ? 'ACEPTADO' : 'BORRADOR',
        previousContractId: previousContractId,
        contractCode,
        annualConsumption: supplyPoint.annualConsumption || lead.estimatedMWh || (sipsConsumoKWh ? sipsConsumoKWh / 1000 : null),
        iban: cData.iban || null,
        transferencia: isTransferencia,
        isMultipoint,
        autoconsumo: hasAutoconsumo,
        bolsilloSolar: hasBolsilloSolar,
        internalComments: cData.comments || null,
        tramitationType: tramName,
        tipo: getTramitationCodes(tramName).tipo,
        tipoC2: getTramitationCodes(tramName).tipoC2,
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
        fee: marginSnap.fee,
        marginFC: marginSnap.marginFC,
        ip1: marginSnap.ip1,
        ip2: marginSnap.ip2,
        ip3: marginSnap.ip3,
        ip4: marginSnap.ip4,
        ip5: marginSnap.ip5,
        ip6: marginSnap.ip6,
        productTypeSnapshot: marginSnap.productTypeSnapshot,
        // Reglas 207 y 230: Solo copiar PExc / FeeExcedentes si hay autoconsumo, y CG Bolsillo Solar solo si Bolsillo Solar fue contratado
        pexc: hasAutoconsumo ? (parseFloat(cData.pexc) || product.pexc || null) : null,
        feeExcedentes: hasAutoconsumo ? (parseFloat(cData.feeExcedentes) || product.feeExcedentes || null) : null,
        cgBolsilloSolar: hasBolsilloSolar ? (parseFloat(cData.cgBolsilloSolar) || product.cgBolsilloSolar || null) : null,
        deviationCost: parseFloat(cData.deviationCost) || product.deviationCost || null,
        pricingModel: product.pricingModel || null,
        commissionType: product.commissionType || null,
        powerTiersCommission: product.powerTiersCommission ? product.powerTiersCommission : undefined,
        permanenceMonths: product.permanenceMonths ?? null,
        svaConcept: svaConceptToSave,
        svaPrice: svaPriceToSave,
        svaDuration: svaDurationToSave,
        additionalServicesSnapshot: additionalServicesSnapshot ?? undefined,
        AdditionalService: additionalServiceConnect,
      },
    });

    // Vincular la documentación subida en el Lead también al Contrato, Cliente y Punto de Suministro
    if (lead.documents && lead.documents.length > 0) {
      await prisma.document.updateMany({
        where: { leadId: lead.id },
        data: {
          contractId: contract.id,
          clientId: client.id,
          supplyPointId: supplyPoint.id,
        },
      });
    }

    await calculateAndSnapshotContractCommission(contract.id).catch((err) =>
      console.warn('Auto-cálculo de comisión omitido en convertLeadToContractAction:', err)
    );

    // Vincular el Contrato al Lead inmediatamente para evitar contratos huérfanos o duplicados si falla la previsualización PDF
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        contractId: contract.id,
        status: 'CONTRATADO',
        contractData: cData,
        estimatedMWh: lead.estimatedMWh,
      },
    });

    // 6. Generar PDF de Contrato + Documento Resumen Precontractual (RD 88/2026) con el motor nativo multi-marca y subir a R2 (salvo multipunto)
    let pdfWarning: string | undefined;
    if (!isMultipoint) {
      try {
        const {
          generateAndUploadContractBundle,
          determineContractIsB2B,
          determineContractIsIndexed,
        } = await import('@/lib/contracts/contractPdfService');

        const isB2B = determineContractIsB2B(cleanVat, cData.cnae);
        const isIndexed = determineContractIsIndexed({
          pricingModel: contract.pricingModel,
          productTypeSnapshot: contract.productTypeSnapshot,
          product,
        });
        const templateData = buildTemplateDataFromLead(
          lead,
          cData,
          product,
          contract,
          isB2B,
          client,
          supplyPoint
        );

        const bundle = await generateAndUploadContractBundle({
          brandId: contract.brandId || brandIdToUse,
          contractCode: contract.contractCode || contract.id,
          templateData,
          isB2B,
          isTransferencia,
          isIndexed,
          hasSelfConsumption: hasAutoconsumo,
          hasSolarWallet: hasBolsilloSolar,
        });

        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            pdfUrl: bundle.contractPdfUrl,
            summaryPdfUrl: bundle.summaryPdfUrl,
            templateVersionId: bundle.templateVersionId,
          },
        });
      } catch (pdfError: any) {
        console.error('Error generando PDF para el contrato nativo:', pdfError);
        pdfWarning = pdfError?.message || String(pdfError);
      }
    }

    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/contratos');

    return { success: true, contractId: contract.id, ...(pdfWarning ? { pdfWarning } : {}) };
  } catch (error: any) {
    console.error("Error al convertir Lead a Contrato:", error);
    return { error: 'Ocurrió un error inesperado al procesar la conversión.' };
  }
}

export async function remakeContractAction(leadId: string): Promise<{
  success?: boolean;
  contractId?: string;
  error?: string;
  validationErrors?: string[];
}> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { contract: { include: { client: true, supplyPoint: true } }, documents: true, user: { include: { brand: true } } },
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
    const brandIdToUse = lead.user?.brandId || lead.contract.brandId || (await prisma.brand.findFirst())?.id || '';

    // 1. SIPS OK
    if (
      !lead.sipsOk &&
      lead.sipsMessages &&
      lead.sipsMessages.length > 0 &&
      lead.sipsMessages !== 'SIPS Refrescado Correctamente' &&
      lead.sipsMessages !== 'Validado correctamente contra SIPS'
    ) {
      validationErrors.push(`Aviso de SIPS pendiente de revisión: ${lead.sipsMessages}`);
    }

    // 2. Error NIF apoderado/titular
    const vat = (lead.vatNumber || cData.nif || '').trim().toUpperCase();
    if (!vat || !/^[A-Z0-9]{8,9}$/i.test(vat.replace(/[-\s]/g, ''))) {
      validationErrors.push("El NIF/CIF del titular está vacío o no tiene un formato válido.");
    }

    // 2.5 Validación de Apoderado para Personas Jurídicas (Regla 75)
    const cleanVat = vat.replace(/[-\s]/g, '');
    const isJuridica = /^[A-W]/i.test(cleanVat) && !/^[XYZ]/i.test(cleanVat);
    const apoderadoNombre = String(cData.contactoNombre || cData.representativeName || '').trim();
    const apoderadoApellidos = String(cData.contactoApellidos || cData.representativeLastName || '').trim();
    const apoderadoNif = String(cData.contactoNif || cData.representativeVat || '').trim().toUpperCase();

    if (isJuridica) {
      if (!apoderadoNombre || !apoderadoApellidos || !apoderadoNif) {
        validationErrors.push("Para personas jurídicas (empresas o comunidades), es obligatorio rellenar los datos del Apoderado (Nombre, Apellidos y NIF).");
      }
    }

    // 3. Error CP Titular y Suministro
    const cpTitular = normalizeSpanishPostalCodeOrNull(cData.cp || cData.codigoPostal || cData.direccion?.cp);
    if (cpTitular && !/^\d{5}$/.test(cpTitular)) {
      validationErrors.push("El Código Postal del Titular debe tener 5 dígitos.");
    }
    const cpSuministro = normalizeSpanishPostalCodeOrNull(
      cData.sCp || cData.direccionSuministro?.cp || cData.direccionSuministro?.postalCode || cData.direccion?.cp || cpTitular
    );
    if (!cpSuministro || !/^\d{5}$/.test(cpSuministro)) {
      validationErrors.push("El Código Postal del Punto de Suministro debe tener 5 dígitos.");
    }

    // 4. Tarifa / Consumo (SIPS Jerarquía)
    let finalConsumptionMWh = lead.estimatedMWh || 0;
    const sRaw: any = lead.sipsRawData || {};
    const sipsPs: any = sRaw?.data?.ps?.[0] || {};
    const sipsConsumoKWh = Number(sRaw.consumo || sRaw.Consumo || sRaw.annualConsumption || sipsPs.ConsumoAnualkWh || 0);
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

      // Fallback a lead.sipsRawData y sipsPs
      if (!sipsPostalCode && (sRaw.postalCode || sRaw.codigoPostal || sRaw.cp || sipsPs.CódigoPostalPS)) {
         sipsPostalCode = String(sRaw.postalCode || sRaw.codigoPostal || sRaw.cp || sipsPs.CódigoPostalPS);
      }
      if (!sipsCnae && (sRaw.cnae || sipsPs.CNAE)) sipsCnae = String(sRaw.cnae || sipsPs.CNAE);
      if (!sipsTariff && (sRaw.tariff || sRaw.tarifa || sipsPs.TarifaATR)) sipsTariff = String(sRaw.tariff || sRaw.tarifa || sipsPs.TarifaATR);
      
      for (let i = 1; i <= 6; i++) {
         if (sipsP[i - 1] === null) {
            const rawP = sRaw[`p${i}`] ?? sRaw[`p${i}c`] ?? sipsPs[`PotenciaContratadaP${i}kW`];
            if (rawP !== undefined && rawP !== null && rawP !== '') {
                sipsP[i - 1] = parseFloat(String(rawP).replace(',', '.'));
            }
         }
      }

      sipsPostalCode = normalizeSpanishPostalCodeOrNull(sipsPostalCode);
      if (sipsPostalCode && cpSuministro && sipsPostalCode !== cpSuministro) {
        validationErrors.push(`El Código Postal introducido (${cpSuministro}) no coincide con el del SIPS (${sipsPostalCode}).`);
      }
      if (sipsCnae && cData.cnae && String(sipsCnae).trim() !== String(cData.cnae).trim()) {
        validationErrors.push(`El CNAE introducido (${cData.cnae}) no coincide con el del SIPS (${sipsCnae}).`);
      }

      // 6. Validar Potencias y Tarifa si no hay cambios técnicos (Regla 74)
      const tramitacion = cData.tipoTramitacion || cData.tramitationType || '';
      const requiereVerificacionTecnica = [
        'Cambio comercializadora sin cambios',
        'Cambio comercializadora con cambios administrativos',
        'Modificación de datos administrativos'
      ].includes(tramitacion);

      if (requiereVerificacionTecnica) {
        if (sipsTariff && lead.tariff && sipsTariff !== lead.tariff) {
          validationErrors.push(`La tarifa solicitada (${lead.tariff}) no coincide con la del SIPS (${sipsTariff}) para este tipo de tramitación.`);
        }
        const periodsToCheck = (lead.tariff || '2.0TD') === '2.0TD' ? [1, 2] : [1, 2, 3, 4, 5, 6];
        for (const i of periodsToCheck) {
          const reqPStr = cData.potencias?.[`p${i}`] ?? cData[`p${i}c`] ?? cData[`p${i}`];
          const reqP = parseFloat(String(reqPStr ?? '').replace(',', '.'));
          const sP = sipsP[i - 1];
          if (!isNaN(reqP) && sP !== null && sP !== undefined && !isNaN(sP)) {
             if (Math.abs(reqP - sP) > 0.01) {
                validationErrors.push(`La potencia P${i} solicitada (${reqP} kW) no coincide con la del SIPS (${sP} kW). Selecciona un trámite 'con cambios técnicos' si deseas alterarla.`);
             }
          }
        }
      }
    }

    // 7. Validar congruencia de Tarifa del Producto (Regla 73)
    if (lead.product) {
      let p = null;
      if (lead.product.startsWith('cm')) {
        p = await prisma.product.findUnique({ where: { id: lead.product } });
      } else {
        p =
          (await prisma.product.findFirst({ where: { name: lead.product.trim(), brandId: brandIdToUse } })) ||
          (await prisma.product.findFirst({ where: { name: lead.product.trim() } }));
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

    const wantsPaperInvoice =
      cData.envioFactura === 'Postal' ||
      cData.envioFactura === 'Ambos' ||
      cData.facturasPapel === 'SI' ||
      cData.facturasPapel === 'Si';
    const titularBillingAddr = getTitularAddress(cData) || null;
    const titularCity = cData.direccion?.poblacion || cData.poblacion || null;
    const titularProvince = cData.direccion?.provincia || cData.provincia || null;
    const indivFirstName = !isJuridica ? String(cData.nombre || '').trim() || undefined : undefined;
    const indivLastName1 = !isJuridica ? String(cData.primerApellido || '').trim() || undefined : undefined;
    const indivLastName2 = !isJuridica ? String(cData.segundoApellido || '').trim() || undefined : undefined;
    const repFullName = isJuridica ? `${apoderadoNombre} ${apoderadoApellidos}`.trim() || undefined : undefined;

    // Actualizar Cliente
    await prisma.client.update({
      where: { id: lead.contract.clientId },
      data: {
        businessName: lead.businessName,
        ...(indivFirstName ? { firstName: indivFirstName } : {}),
        ...(indivLastName1 ? { lastName: indivLastName1 } : {}),
        ...(indivLastName2 ? { lastName2: indivLastName2 } : {}),
        ...(repFullName ? { representativeName: repFullName } : {}),
        ...(isJuridica && apoderadoNif ? { representativeVat: apoderadoNif } : {}),
        ...(isJuridica && apoderadoNombre ? { contactName: apoderadoNombre } : {}),
        ...(isJuridica && apoderadoApellidos ? { contactLastName: apoderadoApellidos } : {}),
        ...(isJuridica && apoderadoNif ? { contactVat: apoderadoNif } : {}),
        ...(cData.cnae ? { cnae: String(cData.cnae) } : {}),
        paperInvoice: wantsPaperInvoice,
        ...(titularBillingAddr ? { billingAddress: titularBillingAddr } : {}),
        ...(cpTitular ? { billingPostalCode: cpTitular } : {}),
        ...(titularCity ? { billingCity: titularCity } : {}),
        ...(titularProvince ? { billingProvince: titularProvince } : {}),
        vatNumber: vat || `PENDING-${lead.id}`,
        contactEmail: contactEmail,
        contactEmail2: contactEmail2 || undefined,
        contactEmail3: contactEmail3 || undefined,
        contactPhone: lead.phone,
        clientType: cData.tipoCliente || (isJuridica ? 'Empresa' : 'Persona física'),
        isMultipoint: isMultipoint,
      }
    });

    const hasAutoconsumo =
      cData.autoconsumo === 'SI' ||
      cData.autoconsumo === 'Sí' ||
      cData.autoconsumo === 'Si' ||
      cData.autoconsumo === true;
    const hasBolsilloSolar =
      hasAutoconsumo &&
      (cData.bolsilloSolar === 'SI' ||
        cData.bolsilloSolar === 'Sí' ||
        cData.bolsilloSolar === 'Si' ||
        cData.bolsilloSolar === true);
    const isTransferencia = String(cData.formaPago || '').toLowerCase().includes('transferencia');

    const { calculateSegment } = await import('@/lib/services/SegmentService');
    const newSegment = calculateSegment(
      lead.tariff || '2.0TD',
      finalConsumptionMWh || lead.contract.supplyPoint.annualConsumption,
      parseFloat(cData.potencias?.p1 || cData.p1c || cData.p1) || lead.contract.supplyPoint.p1c,
      cData.cnae || lead.contract.supplyPoint.cnae
    );

    const supplyAddr = getSupplyAddress(cData) || titularBillingAddr || lead.contract.supplyPoint.address || 'Pendiente';
    const supplyCity =
      cData.direccionSuministro?.poblacion || cData.sPoblacion || cData.poblacion || lead.contract.supplyPoint.city || 'Pendiente';
    const supplyCp = normalizeSpanishPostalCode(
      cpSuministro || cData.sCp || cData.cp || lead.contract.supplyPoint.postalCode,
      '00000'
    );
    const supplyProv =
      cData.direccionSuministro?.provincia || cData.sProvincia || cData.provincia || lead.contract.supplyPoint.province || 'Pendiente';

    // Actualizar Punto de Suministro
    await prisma.supplyPoint.update({
      where: { id: lead.contract.supplyPointId },
      data: {
        segment: newSegment,
        cups: (lead.cups || `CUPS-PENDING-${lead.id}`).trim().toUpperCase(),
        address: supplyAddr,
        city: supplyCity,
        postalCode: supplyCp,
        province: supplyProv,
        tariff: lead.tariff || '2.0TD',
        cnae: cData.cnae ? String(cData.cnae) : lead.contract.supplyPoint.cnae,
        annualConsumption: finalConsumptionMWh > 0 ? finalConsumptionMWh : lead.contract.supplyPoint.annualConsumption,
        hasSelfConsumption: hasAutoconsumo,
        iban: cData.iban || lead.contract.supplyPoint.iban,
        paymentMethod: cData.formaPago || lead.contract.supplyPoint.paymentMethod,
      }
    });

    // Producto
    let product = null;
    if (lead.product && lead.product.startsWith('cm')) {
      product = await prisma.product.findUnique({ where: { id: lead.product } });
    } else {
      const pName = (lead.product || 'Producto Genérico').trim();
      product =
        (await prisma.product.findFirst({ where: { name: pName, brandId: brandIdToUse } })) ||
        (await prisma.product.findFirst({ where: { name: pName } }));
    }

    if (!product && brandIdToUse) {
      product = await prisma.product.create({
        data: {
          name: (lead.product || 'Producto Genérico').trim(),
          type: lead.productType || 'FIX',
          brandId: brandIdToUse,
          tariff: lead.tariff || '2.0TD',
        }
      });
    }

    // Actualizar Contrato con nuevos snapshots inmutables y recalcular comisión
    const remakeSnap = extractContractMarginSnapshots(cData, product, lead.productType);
    const tramName = cData.tipoTramitacion || cData.tramitationType || lead.contract.tramitationType || 'Cambio comercializadora sin cambios';

    const updatedContract = await prisma.contract.update({
      where: { id: lead.contract.id },
      data: {
        productId: product?.id || lead.contract.productId,
        status: isMultipoint ? 'ACEPTADO' : 'BORRADOR', // Vuelve a Borrador al rehacer salvo si es Multipunto
        updatedAt: new Date(),
        annualConsumption: lead.estimatedMWh || lead.contract.annualConsumption || lead.contract.supplyPoint.annualConsumption || null,
        iban: cData.iban || lead.contract.iban || null,
        transferencia: isTransferencia,
        isMultipoint,
        autoconsumo: hasAutoconsumo,
        bolsilloSolar: hasBolsilloSolar,
        internalComments: cData.comments || lead.contract.internalComments || null,
        tramitationType: tramName,
        tipo: getTramitationCodes(tramName).tipo,
        tipoC2: getTramitationCodes(tramName).tipoC2,
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
        fee: remakeSnap.fee,
        marginFC: remakeSnap.marginFC,
        ip1: remakeSnap.ip1,
        ip2: remakeSnap.ip2,
        ip3: remakeSnap.ip3,
        ip4: remakeSnap.ip4,
        ip5: remakeSnap.ip5,
        ip6: remakeSnap.ip6,
        productTypeSnapshot: remakeSnap.productTypeSnapshot,
        pexc: hasAutoconsumo ? (parseFloat(cData.pexc) || product?.pexc || null) : null,
        feeExcedentes: hasAutoconsumo ? (parseFloat(cData.feeExcedentes) || product?.feeExcedentes || null) : null,
        cgBolsilloSolar: hasBolsilloSolar ? (parseFloat(cData.cgBolsilloSolar) || product?.cgBolsilloSolar || null) : null,
        deviationCost: parseFloat(cData.deviationCost) || product?.deviationCost || null,
        pricingModel: product?.pricingModel || null,
        commissionType: product?.commissionType || null,
        powerTiersCommission: product?.powerTiersCommission ? product.powerTiersCommission : undefined,
        permanenceMonths: product?.permanenceMonths ?? null,
      },
    });

    if (lead.documents && lead.documents.length > 0) {
      await prisma.document.updateMany({
        where: { leadId: lead.id },
        data: {
          contractId: lead.contract.id,
          clientId: lead.contract.clientId,
          supplyPointId: lead.contract.supplyPointId,
        },
      });
    }

    await calculateAndSnapshotContractCommission(lead.contract.id).catch((err) =>
      console.warn('Auto-cálculo de comisión omitido en remakeContractAction:', err)
    );

    await prisma.lead.update({
      where: { id: leadId },
      data: { 
        contractData: cData,
        estimatedMWh: lead.estimatedMWh
      }
    });

    // Anular cualquier sobre de firma pendiente previo si el contrato ha sido rehecho
    await prisma.signatureEnvelope.updateMany({
      where: {
        contractId: lead.contract.id,
        status: { in: ['SENT', 'VIEWED', 'SUMMARY_ACCEPTED', 'OTP_SENT'] },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Contrato rehecho desde la ficha del Lead con nuevas condiciones.',
      },
    });

    if (!isMultipoint) {
      try {
        const {
          generateAndUploadContractBundle,
          determineContractIsB2B,
          determineContractIsIndexed,
        } = await import('@/lib/contracts/contractPdfService');

        const isB2B = determineContractIsB2B(cleanVat, cData.cnae);
        const isIndexed = determineContractIsIndexed({
          pricingModel: updatedContract.pricingModel,
          productTypeSnapshot: updatedContract.productTypeSnapshot,
          product,
        });

        const templateData = buildTemplateDataFromLead(
          lead,
          cData,
          product,
          updatedContract,
          isB2B,
          lead.contract?.client,
          lead.contract?.supplyPoint
        );

        const bundle = await generateAndUploadContractBundle({
          brandId: updatedContract.brandId || brandIdToUse,
          contractCode: lead.contract.contractCode || lead.contract.id,
          templateData,
          isB2B,
          isTransferencia,
          isIndexed,
          hasSelfConsumption: hasAutoconsumo,
          hasSolarWallet: hasBolsilloSolar,
        });

        await prisma.contract.update({
          where: { id: lead.contract.id },
          data: {
            pdfUrl: bundle.contractPdfUrl,
            summaryPdfUrl: bundle.summaryPdfUrl,
            templateVersionId: bundle.templateVersionId,
          },
        });
      } catch (pdfError: any) {
        console.error('Error generando PDF al rehacer el contrato nativo:', pdfError);
        return { error: 'Error crítico al regenerar PDF: ' + (pdfError.message || String(pdfError)) };
      }
    }

    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/contratos');
    revalidatePath(`/contratos/${lead.contract.id}`);

    return { success: true, contractId: lead.contract.id };

  } catch (error: any) {
    console.error("Error al rehacer Contrato:", error);
    return { error: 'Ocurrió un error inesperado al rehacer el contrato.' };
  }
}

async function resolveContractActionCaller() {
  const { auth } = await import('@/auth');
  const session = await auth();
  if (!session?.user) return null;

  const sessionUser = session.user as any;
  const selectFields = { id: true, email: true, role: true, isActive: true, channelId: true };

  let dbUser = sessionUser.id
    ? await prisma.user.findUnique({ where: { id: sessionUser.id }, select: selectFields })
    : null;

  if (!dbUser && sessionUser.email) {
    dbUser = await prisma.user.findFirst({
      where: { email: { equals: String(sessionUser.email).trim(), mode: 'insensitive' } },
      select: selectFields,
    });
  }

  if (!dbUser || dbUser.isActive === false) return null;

  return {
    ...dbUser,
    isAdminOrBackoffice: ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(dbUser.role),
  };
}

function sanitizeContractForRole(contract: any, role: string) {
  if (!contract) return contract;
  const safeUser = contract.user
    ? (() => {
        const { password: _pwd, ...restUser } = contract.user;
        return restUser;
      })()
    : contract.user;

  if (['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(role)) {
    return { ...contract, user: safeUser };
  }

  const safeProduct = contract.product
    ? (() => {
        const {
          marginFC: _mfc,
          ip1: _ip1,
          ip2: _ip2,
          ip3: _ip3,
          ip4: _ip4,
          ip5: _ip5,
          ip6: _ip6,
          powerTiersCommission: _ptc,
          ...restProd
        } = contract.product as any;
        if (role === 'CLIENT') {
          const { fee: _pfee, deviationCost: _pdsv, ...clientProd } = restProd;
          return clientProd;
        }
        return restProd;
      })()
    : contract.product;

  const {
    marginFC: _mfc,
    ip1: _ip1,
    ip2: _ip2,
    ip3: _ip3,
    ip4: _ip4,
    ip5: _ip5,
    ip6: _ip6,
    powerTiersCommission: _ptc,
    winbackNotes: _wn,
    ...withoutInternalMargins
  } = contract;

  if (role === 'CLIENT') {
    const {
      fee: _fee,
      deviationCost: _dsv,
      commissionBase: _cb,
      commissionFinal: _cf,
      commissionVariable: _cv,
      commissionType: _ct,
      commissionRuleType: _crt,
      commissionRuleValue: _crv,
      internalComments: _ic,
      distributorMsg: _dm,
      winbackStatus: _ws,
      winbackLastContactAt: _wl,
      winbackProductOffered: _wp,
      ...clientSafe
    } = withoutInternalMargins;
    return { ...clientSafe, user: safeUser, product: safeProduct };
  }

  return { ...withoutInternalMargins, user: safeUser, product: safeProduct };
}

function getContractStatusFromDates(
  signatureDate: Date | null | undefined,
  requestDate: Date | null | undefined,
  activationDate: Date | null | undefined,
  terminationDate: Date | null | undefined
): string {
  // Regla 55: El estado final de un contrato cuando causa baja es estrictamente FINALIZADO, nunca BAJA
  if (terminationDate && activationDate) return 'FINALIZADO';
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
    const caller = await resolveContractActionCaller();
    if (!caller || !caller.isAdminOrBackoffice) {
      return { error: 'No tienes permisos para modificar fechas de contratos.' };
    }

    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, ...visibilityFilter },
      include: { supplyPoint: true, product: true }
    });

    if (!contract) return { error: 'Contrato no encontrado o sin permisos' };

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
    await prisma.contract.update({
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
    // AUTO-CÁLCULO DE COMISIÓN (si aún no estaba fijada)
    // =====================================
    if (newStatus === "ACTIVO" && contract.status !== "ACTIVO") {
      await calculateAndSnapshotContractCommission(contract.id, { onlyIfEmpty: true }).catch((err) =>
        console.warn('Auto-cálculo de comisión omitido en updateContractDatesAction:', err)
      );
    }

    // Si el estado es ACTIVO (o FINALIZADO/BAJA, implica que llegó a activarse), actualizamos el SupplyPoint
    if (newStatus === 'ACTIVO' || newStatus === 'FINALIZADO' || newStatus === 'BAJA') {
      const cData = contract.airtableData as any || {};
      const newTariff = contract.product?.tariff || contract.supplyPoint.tariff;

      if (contract.supplyPoint.clientId === contract.clientId) {
        const { calculateSegment } = await import('@/lib/services/SegmentService');
        const newSegment = calculateSegment(
          newTariff,
          contract.supplyPoint.annualConsumption,
          contract.p1c ?? contract.supplyPoint.p1c,
          cData.cnae || contract.supplyPoint.cnae
        );

        await prisma.supplyPoint.update({
          where: { id: contract.supplyPointId },
          data: {
            segment: newSegment,
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
      } else {
        // Clonar y crear un nuevo Supply Point para evitar fuga de datos
        const cups20 = contract.supplyPoint.cups.substring(0, 20);
        const existingSp = await prisma.supplyPoint.findFirst({
          where: { cups: { startsWith: cups20 }, clientId: contract.clientId }
        });

        let newSupplyPointId = contract.supplyPointId;
        if (existingSp) {
          const { calculateSegment } = await import('@/lib/services/SegmentService');
          const newSegment = calculateSegment(
            newTariff,
            existingSp.annualConsumption,
            contract.p1c ?? contract.supplyPoint.p1c,
            cData.cnae || contract.supplyPoint.cnae
          );

          await prisma.supplyPoint.update({
            where: { id: existingSp.id },
            data: {
              segment: newSegment,
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
          newSupplyPointId = existingSp.id;
        } else {
          const { calculateSegment } = await import('@/lib/services/SegmentService');
          const newSegment = calculateSegment(
            newTariff,
            contract.supplyPoint.annualConsumption,
            contract.p1c ?? contract.supplyPoint.p1c,
            cData.cnae || contract.supplyPoint.cnae
          );

          const newSp = await prisma.supplyPoint.create({
            data: {
              segment: newSegment,
              cups: contract.supplyPoint.cups,
              clientId: contract.clientId,
              address: cData.direccion || contract.supplyPoint.address,
              streetType: contract.supplyPoint.streetType,
              street: contract.supplyPoint.street,
              streetNumber: contract.supplyPoint.streetNumber,
              floor: contract.supplyPoint.floor,
              door: contract.supplyPoint.door,
              addressAddition: contract.supplyPoint.addressAddition,
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
              distributor: contract.supplyPoint.distributor,
              annualConsumption: contract.supplyPoint.annualConsumption,
            }
          });
          newSupplyPointId = newSp.id;
        }

        await prisma.contract.update({
          where: { id: contract.id },
          data: { supplyPointId: newSupplyPointId }
        });
      }
    }

    // Si el contrato pasa a ACTIVO por primera vez y hay un anterior, lo finalizamos (Regla 55)
    if (newStatus === 'ACTIVO' && contract.status !== 'ACTIVO' && contract.previousContractId) {
      await prisma.contract.update({
        where: { id: contract.previousContractId },
        data: {
          status: 'FINALIZADO',
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
  const { sendContractToSignatureAction } = await import('@/app/actions/signatureActions');
  return sendContractToSignatureAction(contractId);
}

export async function updateContractFull(formData: FormData) {
  try {
    const caller = await resolveContractActionCaller();
    if (!caller || !caller.isAdminOrBackoffice) {
      return { error: 'No tienes permisos para editar contratos.' };
    }

    const contractId = formData.get('contractId') as string;
    if (!contractId) throw new Error('Contract ID missing');

    const parseOptionalText = (key: string): string | null | undefined => {
      if (!formData.has(key)) return undefined;
      const raw = String(formData.get(key) ?? '').trim();
      return raw === '' ? null : raw;
    };

    const parseOptionalDate = (key: string): Date | null | undefined => {
      if (!formData.has(key)) return undefined;
      const raw = String(formData.get(key) ?? '').trim();
      if (raw === '') return null;
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    };

    const parseOptionalFloat = (key: string): number | null | undefined => {
      if (!formData.has(key)) return undefined;
      const raw = String(formData.get(key) ?? '').trim();
      if (raw === '') return null;
      const n = parseFloat(raw.replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    };

    const parseOptionalInt = (key: string): number | null | undefined => {
      if (!formData.has(key)) return undefined;
      const raw = String(formData.get(key) ?? '').trim();
      if (raw === '') return null;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : undefined;
    };

    const status = parseOptionalText('status') ?? undefined;
    const internalComments = parseOptionalText('internalComments');
    const signatureDate = parseOptionalDate('signatureDate');
    const requestDate = parseOptionalDate('requestDate');
    const activationDate = parseOptionalDate('activationDate');
    const fechaPrevistaActivacion = parseOptionalDate('fechaPrevistaActivacion');
    const terminationDate = parseOptionalDate('terminationDate');
    const fechaPrevistaBaja = parseOptionalDate('fechaPrevistaBaja');
    const permanenceStartDate = parseOptionalDate('permanenceStartDate');
    const expectedEndDate = parseOptionalDate('expectedEndDate');
    const discountStartDate = parseOptionalDate('discountStartDate');
    const discountEndDate = parseOptionalDate('discountEndDate');
    const svaStartDate = parseOptionalDate('svaStartDate');

    const tramitationType = parseOptionalText('tramitationType');
    const tipo = parseOptionalText('tipo');
    const tipoC2 = parseOptionalText('tipoC2');
    const bajaProcess = parseOptionalText('bajaProcess');
    const distributorMsg = parseOptionalText('distributorMsg');
    const svaConcept = parseOptionalText('svaConcept');
    const iban = parseOptionalText('iban');
    const tariff = parseOptionalText('tariff');

    const duration = parseOptionalInt('duration');
    const svaDuration = parseOptionalInt('svaDuration');

    const commissionBase = parseOptionalFloat('commissionBase');
    const commissionFinal = parseOptionalFloat('commissionFinal');
    const commissionVariable = parseOptionalFloat('commissionVariable');
    const penalization = parseOptionalFloat('penalization');
    const svaPrice = parseOptionalFloat('svaPrice');
    const fee = parseOptionalFloat('fee');
    const feeExcedentes = parseOptionalFloat('feeExcedentes');
    const pexc = parseOptionalFloat('pexc');
    const cgBolsilloSolar = parseOptionalFloat('cgBolsilloSolar');
    const deviationCost = parseOptionalFloat('deviationCost');
    const discountPrice = parseOptionalFloat('discountPrice');

    const p1e = parseOptionalFloat('p1e'); const p2e = parseOptionalFloat('p2e'); const p3e = parseOptionalFloat('p3e');
    const p4e = parseOptionalFloat('p4e'); const p5e = parseOptionalFloat('p5e'); const p6e = parseOptionalFloat('p6e');
    const p1p = parseOptionalFloat('p1p'); const p2p = parseOptionalFloat('p2p'); const p3p = parseOptionalFloat('p3p');
    const p4p = parseOptionalFloat('p4p'); const p5p = parseOptionalFloat('p5p'); const p6p = parseOptionalFloat('p6p');
    const p1c = parseOptionalFloat('p1c'); const p2c = parseOptionalFloat('p2c'); const p3c = parseOptionalFloat('p3c');
    const p4c = parseOptionalFloat('p4c'); const p5c = parseOptionalFloat('p5c'); const p6c = parseOptionalFloat('p6c');

    const file = formData.get('signedContractPdf') as File | null;
    const anexoFile = formData.get('signedAnexoPdf') as File | null;

    const fileUrlStr = formData.get('signedContractPdfUrl') as string | null;
    const fileNameStr = formData.get('signedContractPdfName') as string | null;
    
    const anexoUrlStr = formData.get('signedAnexoPdfUrl') as string | null;
    const anexoNameStr = formData.get('signedAnexoPdfName') as string | null;

    let filePdfSignedUrl: string | undefined = fileUrlStr || undefined;
    let fileAnexoFirmadoUrl: string | undefined = anexoUrlStr || undefined;

    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    // First fetch the existing contract to get client and supply point IDs
    const existing = await prisma.contract.findFirst({
      where: { id: contractId, ...visibilityFilter },
      include: { client: true, supplyPoint: true }
    });

    if (!existing) throw new Error('Contract not found or unauthorized');

    // Handle file upload
    if (fileUrlStr && fileNameStr) {
      await prisma.document.create({
        data: {
          type: 'Contrato',
          url: fileUrlStr,
          name: fileNameStr,
          contractId: contractId,
          clientId: existing.clientId,
          supplyPointId: existing.supplyPointId,
        }
      });
    } else if (file && file.size > 0) {
      const { uploadFileToR2 } = await import('@/lib/r2');
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const url = await uploadFileToR2(`contracts/${contractId}/${file.name}`, buffer, file.type || 'application/pdf');
      filePdfSignedUrl = url;

      await prisma.document.create({
        data: {
          type: 'Contrato',
          url: url,
          name: file.name,
          contractId: contractId,
          clientId: existing.clientId,
          supplyPointId: existing.supplyPointId,
        }
      });
    }

    if (anexoUrlStr && anexoNameStr) {
      await prisma.document.create({
        data: {
          type: 'Anexo',
          url: anexoUrlStr,
          name: anexoNameStr,
          contractId: contractId,
          clientId: existing.clientId,
          supplyPointId: existing.supplyPointId,
        }
      });
    } else if (anexoFile && anexoFile.size > 0) {
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
          contractId: contractId,
          clientId: existing.clientId,
          supplyPointId: existing.supplyPointId,
        }
      });
    }

    let newStatus = status || existing.status;
    
    // Auto-accept if M1, version > 0 and a signed anexo was uploaded
    if (existing.tipo === 'M1' && (existing.version || 0) > 0 && fileAnexoFirmadoUrl) {
      newStatus = 'ACEPTADO';
    }
    
    const isActivo = newStatus === 'ACTIVO';

    const cDataObj = { ...((existing.airtableData as any) || {}) };
    if (tariff) {
      cDataObj.tarifa = tariff;
      cDataObj.Tarifa = tariff;
      cDataObj['Código Tarifa'] = [tariff];
    }

    // Regla 72: La sincronización hacia el CUPS se realiza de forma atómica y exclusiva cuando transiciona a ACTIVO.
    if (existing.status !== 'ACTIVO' && isActivo && existing.supplyPointId) {
      const spSync: any = {};
      if (tariff) spSync.tariff = tariff;
      if (iban || existing.iban) spSync.iban = iban || existing.iban;
      if (p1c !== undefined && p1c !== null) spSync.p1c = p1c;
      if (p2c !== undefined && p2c !== null) spSync.p2c = p2c;
      if (p3c !== undefined && p3c !== null) spSync.p3c = p3c;
      if (p4c !== undefined && p4c !== null) spSync.p4c = p4c;
      if (p5c !== undefined && p5c !== null) spSync.p5c = p5c;
      if (p6c !== undefined && p6c !== null) spSync.p6c = p6c;
      if (Object.keys(spSync).length > 0) {
        await prisma.supplyPoint.update({
          where: { id: existing.supplyPointId },
          data: spSync
        });
      }
    }

    const mappedTramitation = tramitationType ? getTramitationCodes(tramitationType) : { tipo: null, tipoC2: null };
    const preserveSpecialTipo = ['R', 'E1'].includes(existing.tipo || '') && (!tramitationType || tramitationType === existing.tramitationType);

    // Update Contract
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: newStatus || undefined,
        iban: iban,
        bajaProcess: bajaProcess,
        internalComments: internalComments,
        signatureDate: signatureDate,
        requestDate: requestDate,
        activationDate: activationDate,
        fechaPrevistaActivacion: fechaPrevistaActivacion,
        terminationDate: terminationDate,
        fechaPrevistaBaja: fechaPrevistaBaja,
        permanenceStartDate: permanenceStartDate,
        expectedEndDate: expectedEndDate,
        discountStartDate: discountStartDate,
        discountEndDate: discountEndDate,
        svaStartDate: svaStartDate,
        tramitationType: tramitationType !== undefined ? tramitationType : undefined,
        tipo: preserveSpecialTipo ? existing.tipo : (tipo || mappedTramitation.tipo || undefined),
        tipoC2: preserveSpecialTipo ? existing.tipoC2 : (tipoC2 || mappedTramitation.tipoC2 || undefined),
        distributorMsg: distributorMsg,
        svaConcept: svaConcept,
        duration: duration,
        svaDuration: svaDuration,
        commissionBase, commissionFinal, commissionVariable,
        penalization, svaPrice, fee, feeExcedentes, pexc, cgBolsilloSolar, deviationCost, discountPrice,
        p1e, p2e, p3e, p4e, p5e, p6e,
        p1p, p2p, p3p, p4p, p5p, p6p,
        p1c, p2c, p3c, p4c, p5c, p6c,
        airtableData: cDataObj,
        filePdfSigned: filePdfSignedUrl || undefined,
        fileAnexoFirmado: fileAnexoFirmadoUrl || undefined,
      }
    });

    if (existing.status !== 'ACTIVO' && isActivo && (commissionFinal === undefined || commissionFinal === null)) {
      await calculateAndSnapshotContractCommission(contractId, { onlyIfEmpty: true }).catch((err) =>
        console.warn('Auto-cálculo de comisión omitido en updateContractFull:', err)
      );
    }

    revalidatePath('/contratos');
    revalidatePath(`/contratos/${contractId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error in updateContractFull:', error);
    return { error: error.message || 'Error updating contract' };
  }
}

const IN_PROGRESS_STATUSES = [
  'TRAMITANDO',
  'Tramitando',
  'ACEPTADO',
  'VERIFICANDO_FIRMA',
  'BORRADOR',
  'RENOVACION',
];

function buildContractsFilterClause(
  visibilityFilter: any,
  searchTerm: string,
  estadoFilter: string,
  tarifaFilter: string,
  canalFilter: string,
  tipoFilter: string,
  activeOnDate?: string
) {
  const andConditions: any[] = [visibilityFilter];

  const cleanSearch = (searchTerm || '').trim();
  if (cleanSearch) {
    const terms = cleanSearch.split(/\s+/).filter(Boolean);
    for (const term of terms) {
      andConditions.push({
        OR: [
          { contractCode: { contains: term, mode: 'insensitive' } },
          { nSolicitud: { contains: term, mode: 'insensitive' } },
          { supplyPoint: { cups: { contains: term, mode: 'insensitive' } } },
          { supplyPoint: { address: { contains: term, mode: 'insensitive' } } },
          { supplyPoint: { city: { contains: term, mode: 'insensitive' } } },
          { supplyPoint: { postalCode: { contains: term, mode: 'insensitive' } } },
          { client: { businessName: { contains: term, mode: 'insensitive' } } },
          { client: { firstName: { contains: term, mode: 'insensitive' } } },
          { client: { lastName: { contains: term, mode: 'insensitive' } } },
          { client: { vatNumber: { contains: term, mode: 'insensitive' } } },
          { product: { name: { contains: term, mode: 'insensitive' } } },
          { user: { name: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }
  }

  if (estadoFilter && estadoFilter !== 'Todos') {
    if (estadoFilter === 'EN_PROCESO') {
      andConditions.push({ status: { in: IN_PROGRESS_STATUSES } });
    } else if (estadoFilter === 'FINALIZADO' || estadoFilter === 'BAJA') {
      andConditions.push({ status: { in: ['FINALIZADO', 'Finalizado', 'BAJA'] } });
    } else if (estadoFilter === 'RECHAZO_DISTRIBUIDORA') {
      andConditions.push({
        status: { in: ['RECHAZO_DISTRIBUIDORA', 'Rechazo Distribuidora', 'RECHAZO DISTRIBUIDORA'] },
      });
    } else if (estadoFilter === 'RECHAZADO_TODOS') {
      andConditions.push({
        status: {
          in: [
            'RECHAZADO',
            'RECHAZO_DISTRIBUIDORA',
            'Rechazo Distribuidora',
            'RECHAZO DISTRIBUIDORA',
            'RECHAZO_COMERCIALIZADORA',
            'RECHAZO_RIESGOS',
            'RECHAZADO_POR_CLIENTE',
          ],
        },
      });
    } else if (estadoFilter === 'ACTIVO') {
      andConditions.push({ status: { in: ['ACTIVO', 'Activo'] } });
    } else if (estadoFilter === 'TRAMITANDO') {
      andConditions.push({ status: { in: ['TRAMITANDO', 'Tramitando'] } });
    } else {
      andConditions.push({ status: estadoFilter });
    }
  }

  if (activeOnDate) {
    const targetEndOfDay = new Date(`${activeOnDate}T23:59:59.999Z`);
    if (!isNaN(targetEndOfDay.getTime())) {
      if (!estadoFilter || estadoFilter === 'Todos') {
        andConditions.push({ status: { in: ['ACTIVO', 'Activo', 'FINALIZADO', 'Finalizado', 'BAJA'] } });
      }
      andConditions.push(
        { activationDate: { lte: targetEndOfDay } },
        {
          OR: [{ terminationDate: null }, { terminationDate: { gt: targetEndOfDay } }],
        }
      );
    }
  }

  if (tarifaFilter && tarifaFilter !== 'Todas') {
    andConditions.push({
      OR: [{ supplyPoint: { tariff: tarifaFilter } }, { product: { tariff: tarifaFilter } }],
    });
  }

  if (canalFilter && canalFilter !== 'Todos') {
    andConditions.push({
      user: {
        channel: {
          name: canalFilter,
        },
      },
    });
  }

  if (tipoFilter && tipoFilter !== 'Todos') {
    andConditions.push({ tipo: tipoFilter });
  }

  const hasNarrowFilters = Boolean(
    cleanSearch ||
      (estadoFilter && estadoFilter !== 'Todos') ||
      (tarifaFilter && tarifaFilter !== 'Todas') ||
      (canalFilter && canalFilter !== 'Todos') ||
      (tipoFilter && tipoFilter !== 'Todos') ||
      activeOnDate
  );

  const whereClause = andConditions.length === 1 ? andConditions[0] : { AND: andConditions };
  return { whereClause, hasNarrowFilters };
}

function resolveContractAttachmentUrls(c: any) {
  const airtableData = (c?.airtableData as any) || {};

  let signedUrl = c?.filePdfSigned || null;
  if (!signedUrl && Array.isArray(airtableData['PDF Contrato firmado']) && airtableData['PDF Contrato firmado'].length > 0) {
    signedUrl = airtableData['PDF Contrato firmado'][0].url;
  } else if (!signedUrl && Array.isArray(airtableData['Contrato .PDF']) && airtableData['Contrato .PDF'].length > 0) {
    signedUrl = airtableData['Contrato .PDF'][0].url;
  }

  let draftUrl = c?.pdfUrl || null;
  if (!draftUrl && Array.isArray(airtableData['Borrador contrato']) && airtableData['Borrador contrato'].length > 0) {
    draftUrl = airtableData['Borrador contrato'][0].url;
  }

  let annexUrl = c?.fileAnexoFirmado || null;
  if (!annexUrl && Array.isArray(airtableData['PDF Anexo firmado']) && airtableData['PDF Anexo firmado'].length > 0) {
    annexUrl = airtableData['PDF Anexo firmado'][0].url;
  }

  return { signedUrl, draftUrl, annexUrl };
}

export async function getPaginatedContractsAction(
  page: number,
  limit: number,
  searchTerm: string,
  estadoFilter: string,
  tarifaFilter: string,
  canalFilter: string,
  tipoFilter: string,
  sortCol: string | null,
  sortDir: 'asc' | 'desc',
  activeOnDate?: string
) {
  try {
    const caller = await resolveContractActionCaller();
    if (!caller) {
      return { success: false, error: 'No autorizado' };
    }

    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    const { whereClause, hasNarrowFilters } = buildContractsFilterClause(
      visibilityFilter,
      searchTerm,
      estadoFilter,
      tarifaFilter,
      canalFilter,
      tipoFilter,
      activeOnDate
    );

    let orderBy: any = undefined;
    if (sortCol) {
      if (sortCol === 'fechaRegistro') orderBy = { createdAt: sortDir };
      else if (sortCol === 'fechaAlta') orderBy = { activationDate: sortDir };
      else if (sortCol === 'estado') orderBy = { status: sortDir };
      else if (sortCol === 'cups') orderBy = { supplyPoint: { cups: sortDir } };
      else if (sortCol === 'cliente') orderBy = { client: { businessName: sortDir } };
      else if (sortCol === 'producto') orderBy = { product: { name: sortDir } };
      else if (sortCol === 'consumoMwh') orderBy = { supplyPoint: { annualConsumption: sortDir } };
      else if (sortCol === 'canal') orderBy = { user: { channel: { name: sortDir } } };
      else if (sortCol === 'comercial') orderBy = { user: { name: sortDir } };
      else orderBy = { createdAt: 'desc' };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    const orderByParams: any[] = Array.isArray(orderBy) ? [...orderBy] : [orderBy];
    orderByParams.push({ version: 'desc' });

    const allMatching = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        contractCode: true,
        version: true,
        status: true,
        supplyPointId: true,
        signatureDate: true,
        activationDate: true,
        terminationDate: true,
        annualConsumption: true,
        supplyPoint: { select: { cups: true, annualConsumption: true } },
      },
      orderBy: orderByParams,
    });

    // Filtramos FALSAS BAJAS (Regla 47 y Regla 55: si hay otro contrato dentro de 30 días de gracia en el mismo CUPS, no es baja)
    // Si se consulta activos a una fecha específica (activeOnDate), NO excluimos contratos que renovaron posteriormente, ya que en esa fecha sí eran el contrato activo vigente.
    const bajaContracts = activeOnDate
      ? []
      : allMatching.filter(
          (c) => ['BAJA', 'FINALIZADO', 'Finalizado'].includes(c.status) && (c.supplyPoint?.cups || c.supplyPointId)
        );
    const falseBajaIds = new Set<string>();

    if (bajaContracts.length > 0) {
      const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
      const allContractsForCups = hasNarrowFilters
        ? await prisma.contract.findMany({
            where: {
              AND: [
                visibilityFilter,
                { status: { in: ['ACTIVO', 'Activo', 'BAJA', 'FINALIZADO', 'Finalizado'] } },
              ],
            },
            select: {
              id: true,
              contractCode: true,
              supplyPointId: true,
              activationDate: true,
              terminationDate: true,
              supplyPoint: { select: { cups: true } },
            },
          })
        : allMatching.filter((c) =>
            ['ACTIVO', 'Activo', 'BAJA', 'FINALIZADO', 'Finalizado'].includes(c.status)
          );

      const contractsByCups: Record<string, typeof allContractsForCups> = {};
      for (const c of allContractsForCups) {
        const key = c.supplyPoint?.cups?.substring(0, 20) || c.supplyPointId;
        if (!key) continue;
        if (!contractsByCups[key]) contractsByCups[key] = [];
        contractsByCups[key].push(c);
      }

      for (const baja of bajaContracts) {
        if (!baja.terminationDate) continue;

        const key = baja.supplyPoint?.cups?.substring(0, 20) || baja.supplyPointId;
        const siblings = contractsByCups[key] || [];
        const bajaTermTime = baja.terminationDate.getTime();
        const bajaActTime = baja.activationDate ? baja.activationDate.getTime() : 0;

        let isFalseBaja = false;
        for (const sibling of siblings) {
          if (sibling.id === baja.id) continue;
          if (sibling.contractCode && sibling.contractCode === baja.contractCode) continue;
          if (!sibling.activationDate) continue;

          const siblingActTime = sibling.activationDate.getTime();
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

    // Pre-calcular el mejor ID para cada contractCode (priorizando ACTIVO > EN_PROCESO > FINALIZADO > mayor versión)
    const bestIdForCode = new Map<string, string>();
    const groupMap = new Map<string, typeof allMatching>();

    for (const item of allMatching) {
      if (falseBajaIds.has(item.id)) continue;
      if (item.contractCode) {
        if (!groupMap.has(item.contractCode)) groupMap.set(item.contractCode, []);
        groupMap.get(item.contractCode)!.push(item);
      }
    }

    for (const [code, group] of groupMap.entries()) {
      const sortedByVersion = [...group].sort((a, b) => (b.version || 0) - (a.version || 0));
      const active = sortedByVersion.find((c) => c.status === 'ACTIVO' || c.status === 'Activo');
      const inProgress = sortedByVersion.find((c) => IN_PROGRESS_STATUSES.includes(c.status));
      const fin = sortedByVersion.find((c) => c.status === 'FINALIZADO' || c.status === 'Finalizado');
      const chosen = active || inProgress || fin || sortedByVersion[0];
      bestIdForCode.set(code, chosen.id);
    }

    const seenCodes = new Set<string>();
    const rawDeduplicatedIds: string[] = [];

    for (const item of allMatching) {
      if (falseBajaIds.has(item.id)) continue;

      if (item.contractCode) {
        if (!seenCodes.has(item.contractCode)) {
          seenCodes.add(item.contractCode);
          rawDeduplicatedIds.push(bestIdForCode.get(item.contractCode)!);
        }
      } else {
        rawDeduplicatedIds.push(item.id);
      }
    }

    let deduplicatedIds: string[] = rawDeduplicatedIds;
    let activeOnDateMwh: number | null = null;

    if (activeOnDate) {
      const targetEndOfDay = new Date(`${activeOnDate}T23:59:59.999Z`);
      const targetTime = targetEndOfDay.getTime();
      const itemById = new Map(allMatching.map((i) => [i.id, i]));
      const bestByCups = new Map<string, (typeof allMatching)[0]>();

      for (const id of rawDeduplicatedIds) {
        const item = itemById.get(id);
        if (!item) continue;
        const cupsKey = item.supplyPoint?.cups?.substring(0, 20) || item.supplyPointId || item.id;
        if (!bestByCups.has(cupsKey)) {
          bestByCups.set(cupsKey, item);
        } else {
          const existing = bestByCups.get(cupsKey)!;
          const itemSignedByTarget = !item.signatureDate || item.signatureDate.getTime() <= targetTime;
          const existSignedByTarget = !existing.signatureDate || existing.signatureDate.getTime() <= targetTime;

          if (itemSignedByTarget && !existSignedByTarget) {
            bestByCups.set(cupsKey, item);
          } else if (itemSignedByTarget === existSignedByTarget) {
            const itemAct = item.activationDate ? item.activationDate.getTime() : 0;
            const existAct = existing.activationDate ? existing.activationDate.getTime() : 0;
            if (itemAct > existAct) {
              bestByCups.set(cupsKey, item);
            }
          }
        }
      }

      const validIdSet = new Set(Array.from(bestByCups.values()).map((i) => i.id));
      deduplicatedIds = rawDeduplicatedIds.filter((id) => validIdSet.has(id));

      let sumMwh = 0;
      for (const item of bestByCups.values()) {
        sumMwh += item.annualConsumption ?? item.supplyPoint?.annualConsumption ?? 0;
      }
      activeOnDateMwh = sumMwh;
    }

    const totalCount = deduplicatedIds.length;

    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(Math.max(1, limit || 100), 500);
    const offset = (safePage - 1) * safeLimit;
    const pageIds = deduplicatedIds.slice(offset, offset + safeLimit);

    const contracts = pageIds.length
      ? await prisma.contract.findMany({
          where: { id: { in: pageIds } },
          include: {
            Lead: true,
            product: { select: { name: true, tariff: true, type: true, pricingModel: true } },
            user: { select: { name: true, email: true, channel: { select: { name: true } } } },
            client: true,
            supplyPoint: true,
          },
        })
      : [];

    const orderIndex = new Map(pageIds.map((id, idx) => [id, idx]));
    contracts.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

    const uiContracts = contracts.map((c) => {
      const { signedUrl, draftUrl, annexUrl } = resolveContractAttachmentUrls(c);
      const rawUi = {
        ...c,
        lead: c.Lead,
        client: c.client,
        supplyPoint: c.supplyPoint,
        user: c.user,
        product: c.product,
        signedUrl,
        draftUrl,
        annexUrl,
      };
      return sanitizeContractForRole(rawUi, caller.role);
    });

    return { success: true, contracts: uiContracts, totalCount, activeOnDateMwh };
  } catch (error: any) {
    console.error('Error fetching paginated contracts:', error);
    return { success: false, error: error.message };
  }
}

export async function getContractVersionsAction(contractCode: string) {
  try {
    const caller = await resolveContractActionCaller();
    if (!caller) return { success: false, error: 'No autorizado' };

    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    const versions = await prisma.contract.findMany({
      where: {
        AND: [visibilityFilter, { contractCode }],
      },
      select: {
        id: true,
        version: true,
        createdAt: true,
        status: true,
      },
      orderBy: { version: 'desc' },
    });

    return { success: true, versions };
  } catch (error: any) {
    console.error('Error fetching contract versions:', error);
    return { success: false, error: error.message };
  }
}

export async function getContractStatsAction() {
  try {
    const caller = await resolveContractActionCaller();
    if (!caller) return { success: false, error: 'No autorizado' };

    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    const allContracts = await prisma.contract.findMany({
      where: visibilityFilter,
      select: {
        id: true,
        contractCode: true,
        version: true,
        status: true,
        activationDate: true,
        terminationDate: true,
        annualConsumption: true,
        supplyPointId: true,
        supplyPoint: { select: { cups: true, annualConsumption: true } },
      },
    });

    // Deduplicate versions by contractCode using the exact same priority rule as the contracts table
    const groupedByCode = new Map<string, typeof allContracts>();
    const standaloneContracts: typeof allContracts = [];

    for (const c of allContracts) {
      if (c.contractCode) {
        if (!groupedByCode.has(c.contractCode)) groupedByCode.set(c.contractCode, []);
        groupedByCode.get(c.contractCode)!.push(c);
      } else {
        standaloneContracts.push(c);
      }
    }

    const deduplicatedContracts: typeof allContracts = [...standaloneContracts];
    for (const group of groupedByCode.values()) {
      const sortedByVersion = [...group].sort((a, b) => (b.version || 0) - (a.version || 0));
      const active = sortedByVersion.find((c) => c.status === 'ACTIVO' || c.status === 'Activo');
      const inProgress = sortedByVersion.find((c) => IN_PROGRESS_STATUSES.includes(c.status));
      const fin = sortedByVersion.find((c) => c.status === 'FINALIZADO' || c.status === 'Finalizado');
      deduplicatedContracts.push(active || inProgress || fin || sortedByVersion[0]);
    }

    let activos = 0;
    let tramitando = 0;
    let totalMwh = 0;
    const countedActiveCups = new Set<string>();

    for (const c of deduplicatedContracts) {
      if (c.status === 'ACTIVO' || c.status === 'Activo') {
        activos++;
        const cupsKey = c.supplyPoint?.cups?.substring(0, 20) || c.supplyPointId || c.id;
        if (cupsKey && !countedActiveCups.has(cupsKey)) {
          totalMwh += c.annualConsumption ?? c.supplyPoint?.annualConsumption ?? 0;
          countedActiveCups.add(cupsKey);
        }
      } else if (IN_PROGRESS_STATUSES.includes(c.status)) {
        tramitando++;
      }
    }

    // Bajas Netas por CUPS físico de 20 caracteres con 30 días de gracia (Regla 17, Regla 47 y Regla 124)
    const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
    const contractsByCups: Record<string, typeof allContracts> = {};
    for (const c of allContracts) {
      if (!['ACTIVO', 'Activo', 'BAJA', 'FINALIZADO', 'Finalizado'].includes(c.status)) continue;
      const cupsKey = c.supplyPoint?.cups?.substring(0, 20) || c.supplyPointId;
      if (!cupsKey || !c.activationDate) continue;
      if (!contractsByCups[cupsKey]) contractsByCups[cupsKey] = [];
      contractsByCups[cupsKey].push(c);
    }

    let netBajasCount = 0;
    Object.values(contractsByCups).forEach((cupsContracts) => {
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

    return { success: true, activos, tramitando, bajas: netBajasCount, totalMwh };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getFullContractAction(id: string) {
  try {
    const caller = await resolveContractActionCaller();
    if (!caller) return { success: false, error: 'No autorizado' };

    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();
    const contract = await prisma.contract.findFirst({
      where: { AND: [visibilityFilter, { id }] },
      include: {
        Lead: true,
        product: true,
        user: { select: { id: true, name: true, email: true, role: true, channelId: true, channel: true } },
        client: true,
        supplyPoint: true,
      },
    });
    if (!contract) return { success: false, error: 'No encontrado' };

    const { signedUrl, draftUrl, annexUrl } = resolveContractAttachmentUrls(contract);
    const enriched = {
      ...contract,
      lead: contract.Lead,
      signedUrl,
      draftUrl,
      annexUrl,
    };

    return { success: true, contract: sanitizeContractForRole(enriched, caller.role) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPresignedUrlAction(path: string, contentType: string) {
  try {
    const caller = await resolveContractActionCaller();
    if (!caller || !caller.isAdminOrBackoffice) {
      return { error: 'No tienes permisos para subir documentos directamente.' };
    }

    const cleanPath = String(path || '').replace(/\.\./g, '').replace(/^\/+/, '');
    if (!cleanPath) {
      return { error: 'Ruta de destino inválida.' };
    }

    const { generatePresignedUrl } = await import('@/lib/r2');
    const urls = await generatePresignedUrl(cleanPath, contentType || 'application/pdf');
    return { success: true, ...urls };
  } catch (error: any) {
    return { error: error.message || 'Error generating presigned URL' };
  }
}

export async function deleteLatestVersionAction(contractId: string) {
  try {
    const caller = await resolveContractActionCaller();
    if (!caller || !caller.isAdminOrBackoffice) {
      return { error: 'No tienes permisos para eliminar versiones de contratos.' };
    }

    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    const contract = await prisma.contract.findFirst({
      where: { AND: [visibilityFilter, { id: contractId }] },
    });
    if (!contract) return { error: 'Contrato no encontrado o sin permisos' };
    if (!contract.contractCode) return { error: 'Este contrato no tiene versiones agrupadas' };

    const versions = await prisma.contract.findMany({
      where: {
        AND: [
          visibilityFilter,
          {
            contractCode: contract.contractCode,
            ...(contract.brandId ? { brandId: contract.brandId } : {}),
          },
        ],
      },
      orderBy: { version: 'desc' },
    });

    if (versions.length <= 1) return { error: 'No se puede eliminar la única versión' };
    if (versions[0].id !== contractId) return { error: 'Solo se puede eliminar la versión más reciente' };

    const previousId = versions[1].id;

    await prisma.$transaction(async (tx) => {
      // Re-enlazar Lead si apunta a la versión eliminada y la anterior aún no tiene otro Lead
      const prevLead = await tx.lead.findUnique({ where: { contractId: previousId }, select: { id: true } });
      if (!prevLead) {
        await tx.lead.updateMany({ where: { contractId }, data: { contractId: previousId } });
      } else {
        await tx.lead.updateMany({ where: { contractId }, data: { contractId: null } });
      }

      // Preservar documentos, eventos de switching y facturas enlazándolos a la versión anterior
      await tx.document.updateMany({ where: { contractId }, data: { contractId: previousId } });
      await tx.switchingEvent.updateMany({ where: { contractId }, data: { contractId: previousId } });
      await tx.f1Invoice.updateMany({ where: { contractId }, data: { contractId: previousId } });
      await tx.invoice.updateMany({ where: { contractId }, data: { contractId: previousId } });
      await tx.internalInvoice.updateMany({ where: { contractId }, data: { contractId: previousId } });
      await tx.penaltyInvoice.updateMany({ where: { contractId }, data: { contractId: previousId } });
      await tx.contract.updateMany({ where: { previousContractId: contractId }, data: { previousContractId: previousId } });

      await tx.commission.deleteMany({ where: { contractId } });
      await tx.contractModification.deleteMany({ where: { contractId } });

      await tx.contract.delete({ where: { id: contractId } });
    });

    revalidatePath('/contratos');
    revalidatePath(`/contratos/${previousId}`);

    return { success: true, previousVersionId: previousId };
  } catch (error: any) {
    console.error('Error deleting latest version:', error);
    return { error: error.message || 'Error al eliminar la versión' };
  }
}

export async function exportContractsExcelAction(
  searchTerm: string,
  estadoFilter: string,
  tarifaFilter: string,
  canalFilter: string,
  tipoFilter: string,
  activeOnDate?: string
) {
  try {
    const caller = await resolveContractActionCaller();
    if (!caller || caller.role === 'CLIENT') {
      return { success: false, error: 'No tienes permisos para exportar contratos.' };
    }

    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    const allDistributors = await prisma.distributor.findMany();
    const distMap = new Map<string, string>();
    allDistributors.forEach((d: any) => distMap.set(d.reeCode, d.name));

    const { whereClause, hasNarrowFilters } = buildContractsFilterClause(
      visibilityFilter,
      searchTerm,
      estadoFilter,
      tarifaFilter,
      canalFilter,
      tipoFilter,
      activeOnDate
    );

    const allMatching = await prisma.contract.findMany({
      where: whereClause,
      include: {
        client: { include: { brand: true } },
        supplyPoint: true,
        product: true,
        user: { select: { id: true, name: true, email: true, channel: true } },
        Lead: true,
      },
      orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
    });

    const groupMap = new Map<string, any[]>();
    for (const c of allMatching) {
      const code = c.contractCode || c.id;
      if (!groupMap.has(code)) groupMap.set(code, []);
      groupMap.get(code)!.push(c);
    }

    const byCode = new Map<string, any>();
    const bajaContracts: any[] = [];

    for (const [code, group] of groupMap.entries()) {
      const sortedByVersion = [...group].sort((a, b) => (b.version || 0) - (a.version || 0));
      const active = sortedByVersion.find((c) => c.status === 'ACTIVO' || c.status === 'Activo');
      const inProgress = sortedByVersion.find((c) => IN_PROGRESS_STATUSES.includes(c.status));
      const fin = sortedByVersion.find((c) => c.status === 'FINALIZADO' || c.status === 'Finalizado');
      const chosen = active || inProgress || fin || sortedByVersion[0];
      byCode.set(code, chosen);
      if (
        !activeOnDate &&
        ['BAJA', 'FINALIZADO', 'Finalizado'].includes(chosen.status) &&
        (chosen.supplyPoint?.cups || chosen.supplyPointId)
      ) {
        bajaContracts.push(chosen);
      }
    }

    const falseBajaIds = new Set<string>();
    if (bajaContracts.length > 0) {
      const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
      const siblingContracts = hasNarrowFilters
        ? await prisma.contract.findMany({
            where: {
              AND: [
                visibilityFilter,
                { status: { in: ['ACTIVO', 'Activo', 'BAJA', 'FINALIZADO', 'Finalizado'] } },
              ],
            },
            select: {
              id: true,
              supplyPointId: true,
              activationDate: true,
              terminationDate: true,
              contractCode: true,
              supplyPoint: { select: { cups: true } },
            },
          })
        : allMatching.filter((c) =>
            ['ACTIVO', 'Activo', 'BAJA', 'FINALIZADO', 'Finalizado'].includes(c.status)
          );

      const contractsByCups: Record<string, typeof siblingContracts> = {};
      for (const c of siblingContracts) {
        const key = c.supplyPoint?.cups?.substring(0, 20) || c.supplyPointId;
        if (!key) continue;
        if (!contractsByCups[key]) contractsByCups[key] = [];
        contractsByCups[key].push(c);
      }

      for (const bc of bajaContracts) {
        if (!bc.terminationDate) continue;
        const key = bc.supplyPoint?.cups?.substring(0, 20) || bc.supplyPointId;
        const siblings = contractsByCups[key];
        if (!siblings) continue;

        let isFalseBaja = false;
        const bcTermination = new Date(bc.terminationDate).getTime();
        const bcActivation = bc.activationDate ? new Date(bc.activationDate).getTime() : 0;

        for (const sib of siblings) {
          if (sib.id === bc.id) continue;
          if (sib.contractCode && sib.contractCode === bc.contractCode) continue;
          if (!sib.activationDate) continue;
          const sibActivation = new Date(sib.activationDate).getTime();
          if (sibActivation >= bcActivation && sibActivation <= bcTermination + GRACE_PERIOD_MS) {
            isFalseBaja = true;
            break;
          }
        }

        if (isFalseBaja) {
          falseBajaIds.add(bc.id);
        }
      }
    }

    let finalContracts = Array.from(byCode.values()).filter((c) => !falseBajaIds.has(c.id));

    if (activeOnDate) {
      const targetEndOfDay = new Date(`${activeOnDate}T23:59:59.999Z`);
      const targetTime = targetEndOfDay.getTime();
      const bestByCups = new Map<string, any>();

      for (const c of finalContracts) {
        const cupsKey = c.supplyPoint?.cups?.substring(0, 20) || c.supplyPointId || c.id;
        if (!bestByCups.has(cupsKey)) {
          bestByCups.set(cupsKey, c);
        } else {
          const existing = bestByCups.get(cupsKey);
          const itemSignedByTarget = !c.signatureDate || new Date(c.signatureDate).getTime() <= targetTime;
          const existSignedByTarget = !existing.signatureDate || new Date(existing.signatureDate).getTime() <= targetTime;

          if (itemSignedByTarget && !existSignedByTarget) {
            bestByCups.set(cupsKey, c);
          } else if (itemSignedByTarget === existSignedByTarget) {
            const itemAct = c.activationDate ? new Date(c.activationDate).getTime() : 0;
            const existAct = existing.activationDate ? new Date(existing.activationDate).getTime() : 0;
            if (itemAct > existAct) {
              bestByCups.set(cupsKey, c);
            }
          }
        }
      }

      const validIdSet = new Set(Array.from(bestByCups.values()).map((c: any) => c.id));
      finalContracts = finalContracts.filter((c) => validIdSet.has(c.id));
    }

    // Si es CANAL o COMERCIAL, exportamos una cartera comercial limpia sin márgenes internos ni códigos TERA
    if (!caller.isAdminOrBackoffice) {
      const portfolioExportData = finalContracts.map((c) => {
        const formatDate = (date: any) => (date ? new Date(date).toLocaleDateString('es-ES') : '');
        const fmtNum = (val: any): string => (val == null || val === '' ? '' : val.toString().replace('.', ','));
        const rawDist = c.supplyPoint?.distributor || c.supplyPoint?.distributorName || '';
        const cleanDist = rawDist ? String(rawDist).replace(/^\[\d+\]\s*/, '') : '';
        const resolvedDist = cleanDist && /^\d+$/.test(cleanDist) ? distMap.get(cleanDist) || cleanDist : cleanDist;

        return {
          Contrato: c.contractCode || c.id,
          CUPS: c.supplyPoint?.cups || c.Lead?.cups || '',
          Cliente: c.client?.businessName || [c.client?.firstName, c.client?.lastName].filter(Boolean).join(' ') || '',
          'NIF / CIF': c.client?.vatNumber || c.Lead?.vatNumber || '',
          'Dirección Suministro': c.supplyPoint?.address || '',
          CP: c.supplyPoint?.postalCode || '',
          Población: c.supplyPoint?.city || '',
          Provincia: c.supplyPoint?.province || '',
          Distribuidora: resolvedDist,
          Estado: c.status || '',
          Tramitación: c.tramitationType || c.tipo || '',
          Producto: c.product?.name || c.Lead?.product || '',
          Tarifa: c.supplyPoint?.tariff || c.product?.tariff || '',
          'Consumo Anual (MWh)': fmtNum(c.annualConsumption ?? c.supplyPoint?.annualConsumption ?? c.Lead?.estimatedMWh),
          'P1C (kW)': fmtNum(c.p1c ?? c.supplyPoint?.p1c),
          'P2C (kW)': fmtNum(c.p2c ?? c.supplyPoint?.p2c),
          'P3C (kW)': fmtNum(c.p3c ?? c.supplyPoint?.p3c),
          'P4C (kW)': fmtNum(c.p4c ?? c.supplyPoint?.p4c),
          'P5C (kW)': fmtNum(c.p5c ?? c.supplyPoint?.p5c),
          'P6C (kW)': fmtNum(c.p6c ?? c.supplyPoint?.p6c),
          'Fecha Registro': formatDate(c.createdAt),
          'Fecha Firma': formatDate(c.signatureDate),
          'Fecha Activación': formatDate(c.activationDate),
          'Inicio Permanencia': formatDate(c.permanenceStartDate),
          'Fin Previsto': formatDate(c.expectedEndDate),
          'Fecha Baja': formatDate(c.terminationDate),
          Canal: c.user?.channel?.name || '',
          Comercial: c.user?.name || c.user?.email || '',
          'Comisión Estimada (€)': fmtNum(c.commissionBase),
          'Comisión Final (€)': fmtNum(c.commissionFinal),
        };
      });

      return { success: true, data: portfolioExportData };
    }

    const exportData = finalContracts.map(c => {
      const cd = {
        ...(c.Lead?.contractData as Record<string, any> || {}),
        ...(c.airtableData as Record<string, any> || {})
      };
      const formatStr = (val: any) => val ? String(val) : '';
      const formatDate = (date: any) => date ? new Date(date).toLocaleDateString('es-ES') : '';
      

      const fmtNum = (val: any): string => {
        if (val == null || val === '') return '';
        return val.toString().replace('.', ',');
      };

      const ctUpper = (c.client?.clientType || '').toUpperCase().trim();
      const vatFirst = (c.client?.vatNumber || '').trim().toUpperCase().charAt(0);
      const isJuridica = ctUpper === 'EMPRESA' || ctUpper === 'J' || ctUpper === 'JURÍDICA' || ctUpper === 'JURIDICA' || (!ctUpper && /^[ABCDEFGHJNPQRSUVW]/.test(vatFirst));
      const rawNombreRep = formatStr(cd["Nombre Contacto"]) || formatStr(cd["Nombre Wp"]) || formatStr(cd["Nombre"]) || (c.client?.representativeName || c.client?.contactName || '').split(' ')[0] || '';
      const rawApellidosRep = formatStr(cd["Apellidos Contacto"]) || formatStr(cd["apellidos"]) || (c.client?.representativeName || c.client?.contactName || '').split(' ').slice(1).join(' ') || '';
      const repName = formatStr(cd["NOMBRE Y APELLIDOS"]) || formatStr(cd["Nombre_y_apellidos"]) || c.client?.representativeName || c.client?.contactName || (rawNombreRep + (rawApellidosRep ? ' ' + rawApellidosRep : ''));
      const repVat = c.client?.representativeVat || c.client?.contactVat || formatStr(cd["NIF Contacto"]) || formatStr(cd["Dni"]) || '';
      
      // Construir direcciones limpias
      const cleanDomSoc = formatStr(cd["DOMICILIO SOC"]) || [c.client?.billingStreetType, c.client?.billingStreet, c.client?.billingNumber].filter(Boolean).join(' ').trim() || c.client?.billingAddress?.split(/[\d]{5}/)[0]?.trim() || '';
      const cleanDomPs = formatStr(cd["DOMICILIO PS"]) || [c.supplyPoint?.streetType, c.supplyPoint?.street, c.supplyPoint?.streetNumber].filter(Boolean).join(' ').trim() || c.supplyPoint?.address?.split(/[\d]{5}/)[0]?.trim() || '';
      
      // Limpiar distribuidora y extraer código REE si existe en formato [XXXX]
      const rawDist = c.supplyPoint?.distributor || c.supplyPoint?.distributorName || formatStr(cd["DISTRIBUIDORA"]);
      let cleanDist = rawDist ? String(rawDist).replace(/^\[\d+\]\s*/, '') : '';
      const extractedReeCode = rawDist ? (String(rawDist).match(/^\[(\d+)\]/) || [])[1] : null;
      const finalReeCode = extractedReeCode || c.supplyPoint?.distributorReeCode || formatStr(cd["CODIGO REE DISTRIBUIDORA"]) || formatStr(cd["codigo_ree_distri"]);

      if (cleanDist && /^\d+$/.test(cleanDist)) {
        cleanDist = distMap.get(cleanDist) || cleanDist;
      } else if (!cleanDist && finalReeCode && distMap.has(finalReeCode)) {
        cleanDist = distMap.get(finalReeCode) || '';
      }

      // Mapear código CNMC a Tarifa (según tabla oficial CNMC: 018=2.0TD, 019=3.0TD, 020=6.1TD, 021=6.2TD, 022=6.3TD, 023=6.4TD, 024=3.0TDVE, 025=6.1TDVE)
      const cnmcToTariff = (code: string) => {
        const c = String(code).trim();
        if (c === '018') return '2.0TD';
        if (c === '019') return '3.0TD';
        if (c === '020') return '6.1TD';
        if (c === '021') return '6.2TD';
        if (c === '022') return '6.3TD';
        if (c === '023') return '6.4TD';
        if (c === '024') return '3.0TDVE';
        if (c === '025') return '6.1TDVE';
        if (['2.0TD', '3.0TD', '3.0TDVE', '6.1TD', '6.1TDVE', '6.2TD', '6.3TD', '6.4TD'].includes(c)) return c;
        return null;
      };
      const mappedTarifa = cnmcToTariff(formatStr(cd["Código Tarifa"]) || formatStr(cd["Codigo Tarifa"]));

      return {
        "CONTRATO": c.contractCode || formatStr(cd["CONTRATO"]),
        "EMPRESA": c.client?.brand?.codigoMarca || c.client?.brand?.name || "AED",
        "MARCA": formatStr(cd["MARCA"]) || "AED",
        "CANAL": c.user?.channel?.name || formatStr(cd["CANAL"]),
        "Tipo": c.tipo || formatStr(cd["Tipo"]),
        "Tipo_c2": c.tipoC2 || formatStr(cd["Tipo_c2"]),
        "Peticion_cliente_c2": formatStr(cd["Peticion_cliente_c2"]),
        "Tipo_entrada": c.tipo === 'R' ? "F" : "A",
        "Fecha_prevista": c.tipo === 'R' && c.fechaPrevistaActivacion 
          ? formatDate(c.fechaPrevistaActivacion) 
          : (c.fechaPrevista ? formatDate(c.fechaPrevista) : formatStr(cd["Fecha_prevista"])),
        "Tipo_de_cliente": isJuridica ? 'J' : 'F',
        "NOMBRERAZON SOCIAL": isJuridica 
            ? (c.client?.businessName || formatStr(cd["NOMBRERAZON SOCIAL"]))
            : (c.client?.firstName || formatStr(cd["NOMBRERAZON SOCIAL"])),
        "Primer Apellido": isJuridica 
            ? "" 
            : (c.client?.lastName?.trim().split(/\s+/)[0] || formatStr(cd["Primer Apellido"])),
        "Segundo Apellido": isJuridica 
            ? "" 
            : (c.client?.lastName?.trim().split(/\s+/).slice(1).join(" ") || formatStr(cd["Segundo Apellido"])),
        "CIF": c.client?.vatNumber || formatStr(cd["CIF"]),
        "DOMICILIO SOC": cleanDomSoc,
        "CP SOC": c.client?.billingPostalCode || c.client?.postalCode || formatStr(cd["CP SOC"]),
        "POBLACION SOC": c.client?.billingCity || c.client?.city || formatStr(cd["POBLACION SOC"]),
        "PROVINCIA SOC": c.client?.billingProvince || c.client?.province || formatStr(cd["PROVINCIA SOC"]),
        "Tlf": c.client?.phone || c.client?.contactPhone || formatStr(cd["Tlf"]),
        "Email": c.client?.email || c.client?.contactEmail || formatStr(cd["Email"]),
        "CNAE": c.supplyPoint?.cnae || c.client?.cnae || formatStr(cd["CNAE"]),
        "Captacion_Cliente": "R",
        "Nombre": isJuridica ? rawNombreRep : "",
        "apellidos": isJuridica ? rawApellidosRep : "",
        "domicilio_cont": "",
        "cp_cont": "",
        "poblacion_cont": "",
        "provincia_cont": "",
        "tlf_1": c.client?.contactPhone || c.client?.phone || formatStr(cd["tlf_1"]),
        "tlf2": c.client?.contactPhone2 || formatStr(cd["tlf2"]),
        "email_1": c.client?.contactEmail || c.client?.email || formatStr(cd["email_1"]),
        "factura_si_no": formatStr(cd["factura_si_no"]) || "SI",
        "email_factura": c.client?.invoiceEmail || c.client?.email || formatStr(cd["email_factura"]),
        "Nombre_y_apellidos": isJuridica ? repName : "",
        "En_calidad_de": c.client?.contactRole || formatStr(cd["En_calidad_de"]),
        "Dni": isJuridica ? repVat : "",
        "Tlf_2": c.client?.contactPhone2 || formatStr(cd["Tlf_2"]),
        "Email_2": c.client?.contactEmail2 || formatStr(cd["Email_2"]),
        "DISTRIBUIDORA": cleanDist,
        "codigo_ree_distri": finalReeCode,
        "CUPS": c.supplyPoint?.cups || formatStr(cd["CUPS"]),
        "DOMICILIO PS": cleanDomPs,
        "CP PS": c.supplyPoint?.postalCode || formatStr(cd["CP PS"]),
        "POBLACION PS": c.supplyPoint?.city || formatStr(cd["POBLACION PS"]),
        "PROVINCIA PS": c.supplyPoint?.province || formatStr(cd["PROVINCIA PS"]),
        "duracion": c.duration?.toString() || formatStr(cd["duracion"]) || "12",
        "fecha_firma": formatDate(c.signatureDate) || formatStr(cd["fecha_firma"]),
        "autoconsumo": c.supplyPoint?.hasSelfConsumption ? (c.supplyPoint?.selfConsumptionType || "") : "",
        "autoconsumo_fijo_index": c.supplyPoint?.selfConsumptionType || formatStr(cd["autoconsumo_fijo_index"]),
        "tarifa": c.supplyPoint?.tariff || c.product?.tariff || formatStr(cd["tarifa"]) || formatStr(cd["Tarifa"]) || mappedTarifa,
        "consumo_anual": fmtNum(c.supplyPoint?.annualConsumption) || formatStr(cd["consumo_anual"]),
        "FIJO  INDEX": (c.product?.pricingModel === "FIXED" || c.product?.type === "FIJO") ? "F" : "I",
        "atr_comer": "SI",
        "P1C": fmtNum(c.p1c || c.supplyPoint?.p1c) || formatStr(cd["P1C"]),
        "P2C": fmtNum(c.p2c || c.supplyPoint?.p2c) || formatStr(cd["P2C"]),
        "P3C": fmtNum(c.p3c || c.supplyPoint?.p3c) || formatStr(cd["P3C"]),
        "P4C": fmtNum(c.p4c || c.supplyPoint?.p4c) || formatStr(cd["P4C"]),
        "P5C": fmtNum(c.p5c || c.supplyPoint?.p5c) || formatStr(cd["P5C"]),
        "P6C": fmtNum(c.p6c || c.supplyPoint?.p6c) || formatStr(cd["P6C"]),
        "equipo_distrib": "SI",
        "potencias_distri": "SI",
        "potencia_boe": "NO",
        "un_precio": "NO",
        "dias_pago": "2",
        "suspendido": "NO",
        "swift": c.supplyPoint?.swift || formatStr(cd["swift"]),
        "IBAN": c.iban || c.supplyPoint?.iban || formatStr(cd["IBAN"]),
        "P1P": fmtNum(c.p1p) || formatStr(cd["P1P"]),
        "P2P": fmtNum(c.p2p) || formatStr(cd["P2P"]),
        "P3P": fmtNum(c.p3p) || formatStr(cd["P3P"]),
        "P4P": fmtNum(c.p4p) || formatStr(cd["P4P"]),
        "P5P": fmtNum(c.p5p) || formatStr(cd["P5P"]),
        "P6P": fmtNum(c.p6p) || formatStr(cd["P6P"]),
        "P1E": fmtNum(c.p1e) || formatStr(cd["P1E"]),
        "P2E": fmtNum(c.p2e) || formatStr(cd["P2E"]),
        "P3E": fmtNum(c.p3e) || formatStr(cd["P3E"]),
        "P4E": fmtNum(c.p4e) || formatStr(cd["P4E"]),
        "P5E": fmtNum(c.p5e) || formatStr(cd["P5E"]),
        "P6E": fmtNum(c.p6e) || formatStr(cd["P6E"]),
        "plus": "",
        "cg": "",
        "dsv": fmtNum(c.deviationCost) || formatStr(cd["dsv"]),
        "cierre": "",
        "fee": fmtNum(c.fee) || formatStr(cd["fee"]),
        "precio_autoconsumo": fmtNum(c.pexc) || formatStr(cd["precio_autoconsumo"]),
        "gap_autoconsumo": fmtNum(c.feeExcedentes) || formatStr(cd["gap_autoconsumo"]),
        "p1p_1": formatStr(cd["p1p_1"]),
        "p2p_1": formatStr(cd["p2p_1"]),
        "p3p_1": formatStr(cd["p3p_1"]),
        "p4p_1": formatStr(cd["p4p_1"]),
        "p5p_1": formatStr(cd["p5p_1"]),
        "p6p_1": formatStr(cd["p6p_1"]),
        "p1e_1": formatStr(cd["p1e_1"]),
        "p2e_1": formatStr(cd["p2e_1"]),
        "p3e_1": formatStr(cd["p3e_1"]),
        "p4e_1": formatStr(cd["p4e_1"]),
        "p5e_1": formatStr(cd["p5e_1"]),
        "p6e_1": formatStr(cd["p6e_1"]),
        "plus_1": "",
        "cg_1": "",
        "dsv_1": formatStr(cd["dsv_1"]),
        "cierre_1": "",
        "fee_1": formatStr(cd["fee_1"]),
        "n_cie": c.supplyPoint?.cie || formatStr(cd["n_cie"]),
        "DESCUENTO CIE": fmtNum(c.supplyPoint?.ieDiscount) || formatStr(cd["DESCUENTO CIE"]),
        "precio": c.product?.name || formatStr(cd["precio"]),
        "comision": formatStr(cd["comision"]),
        "comision_variable": formatStr(cd["comision_variable"]),
        "EFACTURA": c.client?.paperInvoice ? "NO" : "SI",
        "Mandato_Doble": "",
        "Concepto_SVA": c.svaConcept || formatStr(cd["Concepto_SVA"]),
        "Precio_SVA": fmtNum(c.svaPrice) || formatStr(cd["Precio_SVA"]),
        "Duracion_SVA": c.svaDuration?.toString() || formatStr(cd["Duracion_SVA"]),
        "Fecha_Inicio_SVA": c.svaStartDate ? formatDate(c.svaStartDate) : formatStr(cd["Fecha_Inicio_SVA"]),
        "inicio_proceso": "",
        "fecha_activacion": formatDate(c.activationDate) || formatStr(cd["fecha_activacion"]),
        "fecha_baja": c.terminationDate ? formatDate(c.terminationDate) : formatStr(cd["fecha_baja"]),
        "FECHA_BAJA_ESTIMADA": "",
        "GAS INCLUIDO": "NO",
        "BOLSILLO SOLAR": c.bolsilloSolar ? "SI" : (c.bolsilloSolar === false ? "NO" : formatStr(cd["BOLSILLO SOLAR"])),
        "CG BOLSILLO SOLAR": (c.bolsilloSolar === false || c.bolsilloSolar === null) ? "" : (fmtNum(c.cgBolsilloSolar) || formatStr(cd["CG BOLSILLO SOLAR"])),
        "p1cd": "",
        "p2cd": "",
        "p3cd": "",
        "p4cd": "",
        "p5cd": "",
        "p6cd": "",
        "isla": "",
        "up": "",
        "estado_cups": "",
        "exento_igic": "",
        "id_crm": "",
        "estado": "",
        "date_expected_end": ""
      };

    });

    return { success: true, data: exportData };
  } catch (error: any) {
    console.error('Error exporting contracts:', error);
    return { success: false, error: error.message };
  }
}
