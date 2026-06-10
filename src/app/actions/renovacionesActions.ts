'use server';

import { prisma } from '@/lib/prisma';
import { getUserVisibilityFilter } from '@/lib/permissions';

export async function getPaginatedRenovacionesAction(
  page: number,
  itemsPerPage: number,
  search: string,
  tarifaFilter: string,
  estadoFilter: string
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

    if (estadoFilter !== 'TODOS') {
      const limitUrgente = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
      const limitProximo = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);

      if (estadoFilter === 'URGENTE') {
        whereClause.expectedEndDate = { ...whereClause.expectedEndDate, lte: limitUrgente };
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

      let estado = 'PENDIENTE';
      if (diffDays <= 20) estado = 'URGENTE';
      else if (diffDays <= 40) estado = 'PROXIMO';

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
    let urgentes = 0;
    let proximos = 0;
    let totalMwhRenovar = 0;

    for (const r of dbRenovaciones) {
      totalMwhRenovar += r.supplyPoint?.annualConsumption || 0;
      
      const dVencimiento = r.expectedEndDate ? new Date(r.expectedEndDate) : new Date();
      const diffTime = dVencimiento.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 20) urgentes++;
      else if (diffDays <= 40) proximos++;
    }

    return {
      success: true,
      stats: {
        totalEnCola: totalCount,
        urgentes,
        proximos,
        totalMwhRenovar
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
