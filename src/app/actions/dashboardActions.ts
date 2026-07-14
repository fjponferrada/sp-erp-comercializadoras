'use server';

import { prisma } from '@/lib/prisma';

export async function getDashboardMetricsAction() {
  try {
    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const filter = await getUserVisibilityFilter();


    // 1. Contratos Activos y Total
    const activosCount = await prisma.contract.count({
      where: { ...filter, status: 'ACTIVO' }
    });

    const tramitandoCount = await prisma.contract.count({
      where: { ...filter, status: 'TRAMITANDO' }
    });

    const rechazosCount = await prisma.contract.count({
      where: {
        ...filter,
        status: { in: ['RECHAZADO', 'RECHAZO_DISTRIBUIDORA', 'RECHAZO_COMERCIALIZADORA', 'RECHAZO_RIESGOS', 'RECHAZADO_POR_CLIENTE'] }
      }
    });

    // 2. Fetch contracts for Net Bajas logic
    const contracts = await prisma.contract.findMany({
      where: {
        ...filter,
        status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] }
      },
      select: {
        id: true,
        activationDate: true,
        terminationDate: true,
        supplyPointId: true
      }
    });

    const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
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

    // 2. MWh Activos (Requiere join con SupplyPoint, no se puede con aggregate en relaciones profundas en prisma tan fácil,
    // usaremos findMany y sumaremos en JS si no son demasiados, o agrupado por DB)
    // Para no traer todos, usaremos un raw query o suma de campo directo si podemos
    // Usamos findMany seleccionando solo annualConsumption de los activos
    const activeContracts = await prisma.contract.findMany({
      where: { ...filter, status: 'ACTIVO' },
      select: { supplyPointId: true, supplyPoint: { select: { annualConsumption: true } } }
    });
    
    let totalMWh = 0;
    const countedCups = new Set<string>();

    activeContracts.forEach(c => {
      if (c.supplyPointId && !countedCups.has(c.supplyPointId)) {
        totalMWh += c.supplyPoint?.annualConsumption || 0;
        countedCups.add(c.supplyPointId);
      }
    });

    // 3. Contratos Recientes
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

    // 5. Análisis Económico (Facturación)
    // Agrupamos las facturas por mes (basado en issueDate)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const recentInvoices = await prisma.invoice.findMany({
      where: {
        contract: filter,
        issueDate: { gte: sixMonthsAgo }
      },
      select: {
        issueDate: true,
        subtotal1: true,
        invoiceType: true,
        margin: true,
      }
    });

    const monthlyStats: Record<string, { revenue: number, margin: number, invoiceCount: number }> = {};
    
    // Inicializar los últimos 6 meses en orden
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      monthlyStats[key] = { revenue: 0, margin: 0, invoiceCount: 0 };
    }

    recentInvoices.forEach(inv => {
      if (!inv.issueDate) return;
      const key = `${monthNames[inv.issueDate.getMonth()]} ${inv.issueDate.getFullYear()}`;
      if (monthlyStats[key]) {
        let revenue = inv.subtotal1 || 0;
        if (inv.invoiceType === 'Abono' && revenue > 0) {
            revenue = -revenue;
        }
        monthlyStats[key].revenue += revenue;
        monthlyStats[key].margin += inv.margin || 0;
        monthlyStats[key].invoiceCount += 1;
      }
    });

    const billingStats = Object.keys(monthlyStats).map(key => ({
      month: key,
      revenue: monthlyStats[key].revenue,
      margin: monthlyStats[key].margin,
      newContracts: monthlyStats[key].invoiceCount // Using it to show invoice count
    }));

    // 4. Renovaciones Críticas (a 45 días vista, y hasta -15 días pasados)
    const next45Days = new Date();
    next45Days.setDate(next45Days.getDate() + 45);
    
    const past15Days = new Date();
    past15Days.setDate(past15Days.getDate() - 15);

    const renewalAlerts = await prisma.contract.findMany({
      where: {
        ...filter,
        status: 'ACTIVO',
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
          id: c.contractCode || c.supplyPoint.cups,
          internalId: c.id,
          client: c.client.businessName,
          status: c.status,
          tariff: c.product.tariff || '-',
          mwh: c.supplyPoint.annualConsumption || 0,
          canal: c.user.channel?.name || c.user.name,
          updatedAt: c.updatedAt
        })),
        renewals: renewalAlerts.map(c => {
          const diffTime = new Date(c.expectedEndDate!).getTime() - new Date().getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return {
            internalId: c.id,
            client: c.client.businessName,
            cups: c.supplyPoint.cups,
            expiresIn: `${diffDays} días`,
            mwh: c.supplyPoint.annualConsumption || 0
          };
        }),
        billingStats
      }
    };
  } catch (error: any) {
    console.error("Error fetching dashboard metrics:", error);
    return { success: false, error: error.message };
  }
}
