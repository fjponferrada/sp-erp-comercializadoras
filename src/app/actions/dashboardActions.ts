'use server';

import { prisma } from '@/lib/prisma';

export async function getDashboardMetricsAction() {
  try {
    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const filter = await getUserVisibilityFilter();

    // 1. Contratos Activos, Tramitando y Rechazos
    const activosCount = await prisma.contract.count({
      where: { ...filter, status: { in: ['ACTIVO', 'Activo'] } }
    });

    const tramitandoCount = await prisma.contract.count({
      where: { ...filter, status: { in: ['TRAMITANDO', 'Tramitando'] } }
    });

    const rechazosCount = await prisma.contract.count({
      where: {
        ...filter,
        status: {
          in: [
            'RECHAZADO',
            'RECHAZO_DISTRIBUIDORA',
            'Rechazo Distribuidora',
            'RECHAZO_COMERCIALIZADORA',
            'RECHAZO_RIESGOS',
            'RECHAZADO_POR_CLIENTE'
          ]
        }
      }
    });

    // 2. Fetch contracts for Net Bajas logic (Regla 47 y Regla 124: agrupar por 20 primeros caracteres del CUPS)
    const contracts = await prisma.contract.findMany({
      where: {
        ...filter,
        status: { in: ['ACTIVO', 'Activo', 'BAJA', 'FINALIZADO', 'Finalizado'] }
      },
      select: {
        id: true,
        activationDate: true,
        terminationDate: true,
        supplyPointId: true,
        supplyPoint: { select: { cups: true } }
      }
    });

    const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const contractsByCups: Record<string, typeof contracts> = {};
    contracts.forEach(c => {
      const cupsStr = c.supplyPoint?.cups?.substring(0, 20) || c.supplyPointId;
      if (!cupsStr || !c.activationDate) return;
      if (!contractsByCups[cupsStr]) contractsByCups[cupsStr] = [];
      contractsByCups[cupsStr].push(c);
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
          // Open period, remains open
        } else {
          if (startNext.getTime() <= currentPeriod.end.getTime() + GRACE_PERIOD_MS) {
            if (!c.terminationDate) {
              currentPeriod.end = null;
            } else if (c.terminationDate.getTime() > currentPeriod.end.getTime()) {
              currentPeriod.end = c.terminationDate;
            }
          } else {
            // Closed period
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

    const bajasCount = netBajasCount;

    // 3. MWh Activos
    const activeContracts = await prisma.contract.findMany({
      where: { ...filter, status: { in: ['ACTIVO', 'Activo'] } },
      select: { supplyPointId: true, supplyPoint: { select: { cups: true, annualConsumption: true } } }
    });
    
    let totalMWh = 0;
    const countedCups = new Set<string>();

    activeContracts.forEach(c => {
      const cupsKey = c.supplyPoint?.cups?.substring(0, 20) || c.supplyPointId;
      if (cupsKey && !countedCups.has(cupsKey)) {
        totalMWh += c.supplyPoint?.annualConsumption || 0;
        countedCups.add(cupsKey);
      }
    });

    // 4. Contratos Recientes
    const recentContracts = await prisma.contract.findMany({
      where: filter,
      orderBy: { updatedAt: 'desc' },
      take: 8,
      include: {
        client: { select: { businessName: true } },
        supplyPoint: { select: { cups: true, annualConsumption: true } },
        product: { select: { tariff: true } },
        user: { select: { channel: { select: { name: true } }, name: true } }
      }
    });

    // 5. Renovaciones Críticas (a 45 días vista, y hasta -15 días pasados)
    const next45Days = new Date();
    next45Days.setDate(next45Days.getDate() + 45);
    
    const past15Days = new Date();
    past15Days.setDate(past15Days.getDate() - 15);

    const renewalAlerts = await prisma.contract.findMany({
      where: {
        ...filter,
        status: { in: ['ACTIVO', 'Activo'] },
        expectedEndDate: { not: null, lte: next45Days, gte: past15Days }
      },
      orderBy: { expectedEndDate: 'asc' },
      take: 10,
      include: {
        client: { select: { businessName: true } },
        supplyPoint: { select: { cups: true, annualConsumption: true } }
      }
    });

    return {
      success: true,
      data: {
        kpis: {
          activos: activosCount,
          tramitando: tramitandoCount,
          rechazos: rechazosCount,
          bajas: bajasCount,
          mwh: totalMWh,
        },
        recentContracts: recentContracts.map(c => ({
          id: c.contractCode || c.supplyPoint?.cups || '-',
          internalId: c.id,
          client: c.client?.businessName || 'Sin cliente',
          status: c.status,
          tariff: c.product?.tariff || '-',
          mwh: c.supplyPoint?.annualConsumption || 0,
          canal: c.user?.channel?.name || c.user?.name || '-',
          updatedAt: c.updatedAt
        })),
        renewals: renewalAlerts.map(c => {
          const diffTime = new Date(c.expectedEndDate!).getTime() - new Date().getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return {
            internalId: c.id,
            client: c.client?.businessName || 'Sin cliente',
            cups: c.supplyPoint?.cups || '-',
            expiresIn: `${diffDays} días`,
            mwh: c.supplyPoint?.annualConsumption || 0
          };
        })
      }
    };
  } catch (error: any) {
    console.error("Error fetching dashboard metrics:", error);
    return { success: false, error: error.message };
  }
}
