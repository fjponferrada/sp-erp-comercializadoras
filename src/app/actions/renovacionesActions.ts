'use server';

import { prisma } from '@/lib/prisma';
import { getUserVisibilityFilter } from '@/lib/permissions';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

export async function getPaginatedRenovacionesAction(
  page: number,
  itemsPerPage: number,
  search: string,
  tarifaFilter: string,
  estadoFilter: string,
  canalFilter: string = 'TODOS'
) {
  try {
    const visibilityFilter = await getUserVisibilityFilter();

    const now = new Date();
    const future90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    let whereClause: any = {
      ...visibilityFilter,
      status: { in: ['ACTIVO', 'TRAMITANDO'] },
      expectedEndDate: { not: null, lte: future90Days }
    };

    if (search) {
      whereClause.OR = [
        { contractCode: { contains: search, mode: 'insensitive' } },
        { supplyPoint: { cups: { contains: search, mode: 'insensitive' } } },
        { client: { businessName: { contains: search, mode: 'insensitive' } } },
        { client: { firstName: { contains: search, mode: 'insensitive' } } },
        { client: { lastName: { contains: search, mode: 'insensitive' } } },
        { client: { vatNumber: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (tarifaFilter !== 'TODAS') {
      whereClause.supplyPoint = {
        ...whereClause.supplyPoint,
        tariff: tarifaFilter
      };
    }

    if (canalFilter !== 'TODOS') {
      whereClause.user = {
        ...whereClause.user,
        channelId: canalFilter
      };
    }

    if (estadoFilter !== 'TODOS') {
      const limitUrgente = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
      const limitProximo = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);

      if (estadoFilter === 'VENCIDO') {
        whereClause.expectedEndDate = { ...whereClause.expectedEndDate, lt: now };
      } else if (estadoFilter === 'URGENTE') {
        whereClause.expectedEndDate = { ...whereClause.expectedEndDate, gte: now, lte: limitUrgente };
      } else if (estadoFilter === 'PROXIMO') {
        whereClause.expectedEndDate = { ...whereClause.expectedEndDate, gt: limitUrgente, lte: limitProximo };
      } else if (estadoFilter === 'PENDIENTE') {
        whereClause.expectedEndDate = { ...whereClause.expectedEndDate, gt: limitProximo, lte: future90Days };
      }
    }

    const totalCount = await prisma.contract.count({ where: whereClause });

    const dbRenovaciones = await prisma.contract.findMany({
      where: whereClause,
      include: {
        client: true,
        supplyPoint: true,
        product: true,
        user: { include: { channel: true } },
        Lead: true,
        AdditionalService: true,
        other_Contract: { select: { id: true, status: true } }
      },
      orderBy: { permanenceStartDate: 'asc' },
      skip: (page - 1) * itemsPerPage,
      take: itemsPerPage
    });

    const renovacionesData = dbRenovaciones.map((r: any) => {
      const dVencimiento = r.expectedEndDate ? new Date(r.expectedEndDate) : new Date();
      const diffTime = dVencimiento.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const limitUrgente = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
      const limitProximo = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);

      let estado = 'PENDIENTE';
      if (dVencimiento < now) estado = 'VENCIDO';
      else if (dVencimiento <= limitUrgente) estado = 'URGENTE';
      else if (dVencimiento <= limitProximo) estado = 'PROXIMO';

      return {
        id: r.id,
        contractId: r.id,
        clientId: r.clientId,
        cups: r.supplyPoint?.cups || 'Desconocido',
        direccion: r.supplyPoint?.address || 'Sin dirección',
        cliente: r.client?.businessName || `${r.client?.firstName || ''} ${r.client?.lastName || ''}`.trim() || 'Desconocido',
        telefonoContacto: r.client?.contactPhone || '-',
        emailContacto: r.client?.contactEmail || '-',
        emailComercial: r.user?.email || 'Sin agente',
        fechaActivacion: r.activationDate?.toISOString().split('T')[0] || '-',
        tarifa: r.supplyPoint?.tariff || '2.0TD',
        mwh: r.supplyPoint?.annualConsumption || 0,
        vencimiento: r.expectedEndDate?.toISOString().split('T')[0] || '-',
        diasRestantes: diffDays,
        producto: r.product?.name || 'Desconocido',
        canal: r.user?.channel?.name || r.Lead?.source || 'Directo',
        estado,
        hasSelfConsumption: r.supplyPoint?.hasSelfConsumption || false,
        additionalServiceIds: r.AdditionalService?.map((s: any) => s.id) || [],
        hasPendingRenewal: !!r.other_Contract && !['RECHAZADO', 'CANCELADO'].includes(r.other_Contract.status)
      };
    });

    return { success: true, renovaciones: renovacionesData, totalCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getRenovacionesStatsAction() {
  try {
    const visibilityFilter = await getUserVisibilityFilter();

    const now = new Date();
    const future90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const dbRenovaciones = await prisma.contract.findMany({
      where: {
        ...visibilityFilter,
        status: { in: ['ACTIVO', 'TRAMITANDO'] },
        expectedEndDate: { not: null, lte: future90Days }
      },
      select: {
        expectedEndDate: true,
        supplyPoint: { select: { annualConsumption: true } }
      }
    });

    const totalCount = dbRenovaciones.length;
    let vencidos = 0;
    let urgentes = 0;
    let proximos = 0;
    let totalMwhRenovar = 0;

    for (const r of dbRenovaciones) {
      totalMwhRenovar += r.supplyPoint?.annualConsumption || 0;
      
      const dVencimiento = r.expectedEndDate ? new Date(r.expectedEndDate) : new Date();

      const limitUrgente = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
      const limitProximo = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);

      if (dVencimiento < now) vencidos++;
      else if (dVencimiento <= limitUrgente) urgentes++;
      else if (dVencimiento <= limitProximo) proximos++;
    }

    return {
      success: true,
      stats: {
        totalEnCola: totalCount,
        vencidos,
        urgentes,
        proximos,
        totalMwhRenovar
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function renewContractAction(oldContractId: string, newProductId: string, hasSignature: boolean, servicioAdicional?: string, additionalServiceIds: string[] = [], renewalType: 'EXPRESA' | 'TACITA' = 'EXPRESA') {
  try {
    const oldContract = await prisma.contract.findUnique({
      where: { id: oldContractId },
      include: {
        client: true,
        supplyPoint: true,
        user: { include: { brand: true } },
      }
    });

    if (!oldContract) return { error: 'Contrato original no encontrado.' };

    const product = await prisma.product.findUnique({
      where: { id: newProductId }
    }) as any;

    if (!product) return { error: 'Producto seleccionado no encontrado.' };

    let contractCode = '';
    let version = 0;
    
    if (renewalType === 'TACITA') {
      contractCode = oldContract.contractCode || '';
      version = (oldContract.version ?? 0) + 1;
    } else {
      // Generar código de contrato nuevo
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      
      const isCompany = oldContract.client.vatNumber.toUpperCase().startsWith('A') || oldContract.client.vatNumber.toUpperCase().startsWith('B');
      const typeChar = isCompany ? 'E' : 'P';
      
      const brandPrefix = oldContract.user?.brand?.codigoMarca || 'AED';
      const userPrefix = oldContract.user?.codigo || 'U';
      const prefix = `${brandPrefix}${userPrefix}${typeChar}`;
      
      const cupsLast4 = oldContract.supplyPoint.cups ? oldContract.supplyPoint.cups.slice(-4) : '0000';
      contractCode = `${prefix}${year}${month}${day}${hour}${min}${cupsLast4}`;
      
      const existingCode = await prisma.contract.findFirst({ where: { contractCode } });
      if (existingCode) {
        contractCode = `${contractCode}-${Math.floor(Math.random() * 1000)}`;
      }
    }

    const cData = oldContract.airtableData as any || {};
    
    let additionalServicesSnapshot = null;
    let additionalServiceConnect = undefined;
    if (additionalServiceIds && additionalServiceIds.length > 0) {
      const services = await prisma.additionalService.findMany({
        where: { id: { in: additionalServiceIds } }
      });
      additionalServiceConnect = { connect: services.map((s: any) => ({ id: s.id })) };
      additionalServicesSnapshot = services.map((s: any) => ({
        id: s.id,
        name: s.name,
        monthlyPrice: s.monthlyPrice,
        dailyPrice: s.dailyPrice,
        durationMonths: s.durationMonths,
        isCommissionable: s.isCommissionable
      }));
    }
    
    // Si han seleccionado servicios adicionales por ID, vamos a rellenar también los campos legacy (svaConcept, svaPrice) para que la vista ContractDetailClient lo muestre bien
    let svaConcept = servicioAdicional || product.svaConcept || undefined;
    let svaPrice = undefined;
    let svaDurationToSave = undefined;
    if (additionalServiceIds && additionalServiceIds.length > 0 && additionalServicesSnapshot && additionalServicesSnapshot.length > 0) {
      const firstService = additionalServicesSnapshot[0];
      svaConcept = firstService.name;
      svaDurationToSave = firstService.durationMonths;
      
      // El motor de facturación requiere el precio TOTAL del servicio para prorratearlo
      if (firstService.monthlyPrice !== null && firstService.monthlyPrice !== undefined) {
        svaPrice = firstService.monthlyPrice * (firstService.durationMonths || 120);
      } else if (firstService.dailyPrice !== null && firstService.dailyPrice !== undefined) {
        svaPrice = firstService.dailyPrice * 30 * (firstService.durationMonths || 120);
      }
    }
    
    let expectedEndDate = null;
    if (renewalType === 'TACITA' && oldContract.expectedEndDate) {
      expectedEndDate = new Date(oldContract.expectedEndDate);
      expectedEndDate.setFullYear(expectedEndDate.getFullYear() + 1);
    }

    // Create new contract
    const newContract = await prisma.contract.create({
      data: {
        contractCode,
        version,
        clientId: oldContract.clientId,
        supplyPointId: oldContract.supplyPointId,
        userId: oldContract.userId,
        brandId: oldContract.brandId,
        productId: product.id,
        previousContractId: oldContract.id,
        tipo: 'R',
        tramitationType: renewalType === 'TACITA' ? 'Renovación' : undefined,
        status: renewalType === 'TACITA' ? 'ACEPTADO' : 'BORRADOR',
        isTacitRenewal: renewalType === 'TACITA',
        signatureDate: renewalType === 'TACITA' ? new Date() : undefined,
        expectedEndDate: expectedEndDate,
        
        AdditionalService: additionalServiceConnect,
        additionalServicesSnapshot: additionalServicesSnapshot ?? undefined,
        
        // Mantener datos técnicos idénticos
        p1c: oldContract.p1c,
        p2c: oldContract.p2c,
        p3c: oldContract.p3c,
        p4c: oldContract.p4c,
        p5c: oldContract.p5c,
        p6c: oldContract.p6c,
        
        // Nuevos datos económicos (del nuevo producto)
        p1e: product.p1e,
        p2e: product.p2e,
        p3e: product.p3e,
        p4e: product.p4e,
        p5e: product.p5e,
        p6e: product.p6e,
        
        p1p: product.p1p,
        p2p: product.p2p,
        p3p: product.p3p,
        p4p: product.p4p,
        p5p: product.p5p,
        p6p: product.p6p,
        
        fee: product.fee,
        svaConcept: svaConcept,
        svaPrice: svaPrice,
        svaDuration: svaDurationToSave,
        feeExcedentes: product.feeExcedentes,
        pexc: product.pexc,
        cgBolsilloSolar: product.cgBolsilloSolar,
        deviationCost: product.deviationCost,
        pricingModel: product.pricingModel,
        commissionType: product.commissionType,
        powerTiersCommission: product.powerTiersCommission ? product.powerTiersCommission : undefined,
        permanenceMonths: product.permanenceMonths,
        
        annualConsumption: oldContract.annualConsumption,
        autoconsumo: oldContract.autoconsumo,
        bolsilloSolar: oldContract.bolsilloSolar,
        isMultipoint: oldContract.isMultipoint,
        iban: oldContract.iban,
        
        airtableData: {
          ...cData,
          producto: product.name,
        }
      }
    });

    if (renewalType === 'TACITA') {
      return { success: true, contractId: newContract.id };
    }

    // Generate PDF
    const { buildTemplateDataFromContract } = await import('@/lib/templateBuilder');
    const { generateContractDocxBuffer } = await import('@/lib/docGenerator');
    const { convertDocxToPdfViaDocuSign } = await import('@/lib/docusignConverter');
    const { uploadFileToR2 } = await import('@/lib/r2');

    const vat = oldContract.client.vatNumber || '';
    const isPersonaFisica = /^[0-9XYZ]/.test(vat) && vat.length === 9;
    const cnae = (cData.cnae || '').trim();
    const isCore = isPersonaFisica && (cnae === '9820' || cnae === '9821');
    const isB2B = !isCore;

    const templateData = buildTemplateDataFromContract(newContract, cData, product, isB2B);
    const docxBuffer = await generateContractDocxBuffer(templateData, isB2B);
    const pdfBuffer = await convertDocxToPdfViaDocuSign(docxBuffer);
    
    const fileName = `Contrato_AED_${newContract.contractCode}.pdf`;
    const uploadedUrl = await uploadFileToR2(`contracts/drafts/${fileName}`, pdfBuffer, 'application/pdf');

    await prisma.contract.update({
      where: { id: newContract.id },
      data: { pdfUrl: uploadedUrl }
    });

    return { success: true, contractId: newContract.id };
  } catch (error: any) {
    console.error("Error renovando contrato:", error);
    return { success: false, error: error.message };
  }
}

export async function comunicarRenovacionTacitaAction(contractId: string) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        client: { include: { brand: true } },
        supplyPoint: true,
        product: true
      }
    });

    if (!contract || !contract.client.contactEmail) {
      return { success: false, error: "Contrato no encontrado o cliente sin email de contacto." };
    }

    if (contract.tipo !== 'R' || contract.status !== 'ACEPTADO' || !contract.isTacitRenewal) {
      return { success: false, error: "El contrato no cumple los requisitos para comunicar renovación tácita." };
    }

    const brand = contract.client.brand;
    const brandName = brand?.name || 'Su Comercializadora';
    const brandColor = brand?.accentColor || '#4F46E5';
    const logoUrl = brand?.invoiceLogoUrl || brand?.logoUrl;
    
    const logoHtml = logoUrl 
      ? `<div style="text-align: left; margin-top: 40px;"><img src="${logoUrl}" alt="${brandName}" style="max-height: 80px;" /></div>`
      : '';

    const clientName = contract.client.firstName 
      ? `${contract.client.firstName} ${contract.client.lastName || ''}`.trim() 
      : contract.client.businessName;

    // Formatting prices safely: truncate to N decimals without rounding
    const formatPrice = (val: any, decimals: number, suffix: string = '€') => {
      if (val === null || val === undefined) return '-';
      const numVal = Number(val);
      if (isNaN(numVal)) return '-';
      
      // Convert to string avoiding scientific notation
      const parts = numVal.toFixed(10).split('.');
      let formatted = parts[0];
      if (decimals > 0) {
        formatted += ',' + parts[1].substring(0, decimals);
      }
      
      return `${formatted} ${suffix}`;
    };

    const pm = contract.pricingModel?.toUpperCase() || '';
    const prodType = contract.product?.type?.toLowerCase() || '';
    const prodName = contract.product?.name?.toLowerCase() || '';
    let isFixed = false;
    if (pm === 'FIJO' || pm === 'FIXED') {
      isFixed = true;
    } else if (pm === 'INDEXADO' || pm === 'INDEX' || pm === 'INDEXED') {
      isFixed = false;
    } else if (prodType.includes('index') || prodType.includes('pass-through') || prodName.includes('index')) {
      isFixed = false;
    } else if (prodType.includes('fijo') || prodName.includes('fijo')) {
      isFixed = true;
    } else {
      isFixed = true; // Default fallback
    }
    const isIndexed = !isFixed;

    let emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <p>Estimado/a <b>${clientName}</b>,</p>
        <p>Le informamos de la renovación de su contrato asociado al suministro <b>${contract.supplyPoint?.cups}</b>.</p>
        <p>De acuerdo con las condiciones vigentes, su contrato ha sido renovado tácitamente. A continuación, detallamos las condiciones económicas que se aplicarán en este nuevo periodo:</p>
        
        <h3 style="color: ${brandColor}; border-bottom: 2px solid ${brandColor}; padding-bottom: 5px;">Término de Potencia</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: ${brandColor}15; text-align: left;">
            <th style="padding: 10px; border: 1px solid #eee;">P1</th>
            <th style="padding: 10px; border: 1px solid #eee;">P2</th>
            <th style="padding: 10px; border: 1px solid #eee;">P3</th>
            <th style="padding: 10px; border: 1px solid #eee;">P4</th>
            <th style="padding: 10px; border: 1px solid #eee;">P5</th>
            <th style="padding: 10px; border: 1px solid #eee;">P6</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p1p, 3, '€/kW/año')}</td>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p2p, 3, '€/kW/año')}</td>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p3p, 3, '€/kW/año')}</td>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p4p, 3, '€/kW/año')}</td>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p5p, 3, '€/kW/año')}</td>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p6p, 3, '€/kW/año')}</td>
          </tr>
        </table>

        ${isIndexed ? `
        <h3 style="color: ${brandColor}; border-bottom: 2px solid ${brandColor}; padding-bottom: 5px;">Término de Energía</h3>
        <p>Se facturará a precio de mercado más un pequeño margen de comercialización de <b>${formatPrice(contract.fee ? Number(contract.fee) / 1000 : null, 3, '€/kWh')}</b>.</p>
        ` : `
        <h3 style="color: ${brandColor}; border-bottom: 2px solid ${brandColor}; padding-bottom: 5px;">Término de Energía</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: ${brandColor}15; text-align: left;">
            <th style="padding: 10px; border: 1px solid #eee;">P1</th>
            <th style="padding: 10px; border: 1px solid #eee;">P2</th>
            <th style="padding: 10px; border: 1px solid #eee;">P3</th>
            <th style="padding: 10px; border: 1px solid #eee;">P4</th>
            <th style="padding: 10px; border: 1px solid #eee;">P5</th>
            <th style="padding: 10px; border: 1px solid #eee;">P6</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p1e, 3, '€/kWh')}</td>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p2e, 3, '€/kWh')}</td>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p3e, 3, '€/kWh')}</td>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p4e, 3, '€/kWh')}</td>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p5e, 3, '€/kWh')}</td>
            <td style="padding: 10px; border: 1px solid #eee;">${formatPrice(contract.p6e, 3, '€/kWh')}</td>
          </tr>
        </table>
        `}
    `;

    if (contract.svaConcept && contract.svaPrice != null && contract.svaDuration != null && contract.svaDuration > 0) {
      const svaMonthly = Number(contract.svaPrice) / contract.svaDuration;
      emailHtml += `
        <h3 style="color: ${brandColor}; border-bottom: 2px solid ${brandColor}; padding-bottom: 5px;">Servicios Adicionales</h3>
        <p>Además, mantendrá el servicio asociado <b>${contract.svaConcept}</b> por un coste de <b>${formatPrice(svaMonthly, 2, '€/mes')}</b>.</p>
      `;
    }

    let contactMethods = `respondiendo a este email`;
    if (brand?.whatsappPhone || brand?.phone) {
      contactMethods += `, o `;
      const methods = [];
      if (brand?.phone) methods.push(`en el <a href="tel:${brand.phone.replace(/\D/g, '')}" style="color: ${brandColor}; text-decoration: none; font-weight: bold;">${brand.phone}</a>`);
      if (brand?.whatsappPhone) methods.push(`por Whatsapp <a href="https://wa.me/${brand.whatsappPhone.replace(/\D/g, '')}" style="color: ${brandColor}; text-decoration: none; font-weight: bold;">haciendo clic aquí</a>`);
      contactMethods += methods.join(' o ');
    }

    emailHtml += `
        <p style="margin-top: 10px;">Para cualquier duda, puede ponerse en contacto con nosotros ${contactMethods}.</p>
        <p>Gracias por seguir confiando en nosotros,</p>
        <p><b>El Equipo de ${brandName}</b></p>
        
        ${logoHtml}
      </div>
    `;

    await resend.emails.send({
      from: brand?.supportEmail ? `${brandName} <${brand.supportEmail}>` : `${brandName} <facturacion@${brand?.domain || 'aed-energia.com'}>`,
      to: contract.client.contactEmail,
      subject: `Aviso de Renovación de Contrato - Suministro ${contract.supplyPoint?.cups || ''}`,
      html: emailHtml
    });

    await prisma.contract.update({
      where: { id: contractId },
      data: { tacitRenewalCommunicatedAt: new Date() }
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error al comunicar renovación tácita:", error);
    return { success: false, error: error.message };
  }
}
