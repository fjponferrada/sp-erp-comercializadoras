'use server';

import { prisma } from '@/lib/prisma';
import { getUserVisibilityFilter } from '@/lib/permissions';

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
        Lead: true
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
        hasSelfConsumption: r.supplyPoint?.hasSelfConsumption || false
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

export async function renewContractAction(oldContractId: string, newProductId: string, hasSignature: boolean, servicioAdicional?: string) {
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
    let contractCode = `${prefix}${year}${month}${day}${hour}${min}${cupsLast4}`;
    
    const existingCode = await prisma.contract.findFirst({ where: { contractCode } });
    if (existingCode) {
      contractCode = `${contractCode}-${Math.floor(Math.random() * 1000)}`;
    }

    const cData = oldContract.airtableData as any || {};
    
    // Create new contract
    const newContract = await prisma.contract.create({
      data: {
        contractCode,
        clientId: oldContract.clientId,
        supplyPointId: oldContract.supplyPointId,
        userId: oldContract.userId,
        brandId: oldContract.brandId,
        productId: product.id,
        previousContractId: oldContract.id,
        tipo: 'R',
        status: 'BORRADOR',
        
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
        svaConcept: servicioAdicional || product.svaConcept,
        commissionBase: product.feeExcedentes,
        
        airtableData: {
          ...cData,
          producto: product.name,
        }
      }
    });

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
    console.error("Error en renewContractAction:", error);
    return { error: error.message || 'Error desconocido al renovar el contrato.' };
  }
}
