'use server';

import { prisma } from '@/lib/prisma';

export async function getEconomicAnalysis() {
  try {
    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const filter = await getUserVisibilityFilter();

    // 1. Fetch Invoices and Group by Month
    const invoices = await prisma.invoice.findMany({
      where: {
        contract: filter
      },
      select: {
        issueDate: true,
        subtotal1: true,
        invoiceType: true,
        totalMWh: true,
        margin: true
      }
    });

    const invoicesData: Record<string, any> = {};
    invoices.forEach(inv => {
      if (!inv.issueDate) return;
      const m = `${inv.issueDate.getFullYear()}-${String(inv.issueDate.getMonth() + 1).padStart(2, '0')}`;
      if (!invoicesData[m]) invoicesData[m] = { total_eur: 0, total_mwh: 0, margin: 0 };
      
      let amount = inv.subtotal1 || 0;
      if (inv.invoiceType === 'Abono' && amount > 0) {
        amount = -amount;
      }
      
      invoicesData[m].total_eur += amount;
      invoicesData[m].total_mwh += (inv.totalMWh || 0);
      invoicesData[m].margin += (inv.margin || 0);
    });

    // 2. Fetch Contracts and Group Altas/Bajas by Month
    const contracts = await prisma.contract.findMany({
      where: {
        ...filter,
        status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] }
      },
      select: {
        activationDate: true,
        terminationDate: true,
        supplyPointId: true,
        supplyPoint: {
          select: { annualConsumption: true }
        }
      }
    });

    const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const altasData: Record<string, { count: number, mwh: number }> = {};
    const bajasData: Record<string, { count: number, mwh: number }> = {};

    const contractsByCups: Record<string, typeof contracts> = {};
    contracts.forEach(c => {
      if (!c.supplyPointId || !c.activationDate) return;
      if (!contractsByCups[c.supplyPointId]) contractsByCups[c.supplyPointId] = [];
      contractsByCups[c.supplyPointId].push(c);
    });

    Object.values(contractsByCups).forEach(cupsContracts => {
      cupsContracts.sort((a, b) => a.activationDate!.getTime() - b.activationDate!.getTime());

      let currentPeriod: { start: Date, end: Date | null, maxMwh: number } | null = null;
      const periods: { start: Date, end: Date | null, mwh: number }[] = [];

      for (const c of cupsContracts) {
        const mwh = c.supplyPoint?.annualConsumption || 0;
        
        if (!currentPeriod) {
          currentPeriod = { start: c.activationDate!, end: c.terminationDate || null, maxMwh: mwh };
          continue;
        }

        const startNext = c.activationDate!;
        
        if (currentPeriod.end === null) {
          currentPeriod.maxMwh = mwh;
        } else {
          if (startNext.getTime() <= currentPeriod.end.getTime() + GRACE_PERIOD_MS) {
            if (!c.terminationDate) {
              currentPeriod.end = null;
            } else if (c.terminationDate.getTime() > currentPeriod.end.getTime()) {
              currentPeriod.end = c.terminationDate;
            }
            currentPeriod.maxMwh = mwh;
          } else {
            periods.push({ start: currentPeriod.start, end: currentPeriod.end, mwh: currentPeriod.maxMwh });
            currentPeriod = { start: c.activationDate!, end: c.terminationDate || null, maxMwh: mwh };
          }
        }
      }

      if (currentPeriod) {
        periods.push({ start: currentPeriod.start, end: currentPeriod.end, mwh: currentPeriod.maxMwh });
      }

      periods.forEach(p => {
        const altaM = `${p.start.getFullYear()}-${String(p.start.getMonth() + 1).padStart(2, '0')}`;
        if (!altasData[altaM]) altasData[altaM] = { count: 0, mwh: 0 };
        altasData[altaM].count++;
        altasData[altaM].mwh += p.mwh;

        if (p.end) {
          const bajaM = `${p.end.getFullYear()}-${String(p.end.getMonth() + 1).padStart(2, '0')}`;
          if (!bajasData[bajaM]) bajasData[bajaM] = { count: 0, mwh: 0 };
          bajasData[bajaM].count++;
          bajasData[bajaM].mwh += p.mwh;
        }
      });
    });

    // 4. Consolidate Data
    const allMonths = new Set<string>();
    Object.keys(invoicesData).forEach(m => allMonths.add(m));
    Object.keys(altasData).forEach(m => allMonths.add(m));
    Object.keys(bajasData).forEach(m => allMonths.add(m));

    const sortedMonths = Array.from(allMonths).sort();
    
    let activeContractsCount = 0;
    let activeMWh = 0;

    const results = sortedMonths.map(month => {
      const inv = invoicesData[month] || { total_eur: 0, total_mwh: 0, margin: 0 };
      const alt = altasData[month] || { count: 0, mwh: 0 };
      const baj = bajasData[month] || { count: 0, mwh: 0 };

      const factEur = inv.total_eur;
      const factMwh = inv.total_mwh;
      const margin = inv.margin;
      
      const altasCount = alt.count;
      const altasMwh = alt.mwh;
      
      const bajasCount = baj.count;
      const bajasMwh = baj.mwh;

      // Acumulados
      activeContractsCount = activeContractsCount + altasCount - bajasCount;
      activeMWh = activeMWh + altasMwh - bajasMwh;

      const crecimientoNeto = activeMWh > 0 ? (altasMwh - bajasMwh) / activeMWh : 0;
      
      return {
        month,
        facturacionEur: factEur,
        facturacionMwh: factMwh,
        eurPerMwh: factMwh > 0 ? factEur / factMwh : 0,
        margenEur: margin,
        margenPercent: factEur > 0 ? margin / factEur : 0,
        altas: altasCount,
        bajas: bajasCount,
        contratosActivos: activeContractsCount,
        mwhAltas: altasMwh,
        mwhBajas: bajasMwh,
        mwhActivos: activeMWh,
        crecimientoMes: crecimientoNeto,
        proyeccionAlta: altasMwh * 200 * ((12 - parseInt(month.split('-')[1])) / 12),
        proyeccionCompleto: altasMwh * 200
      };
    });

    return results;

  } catch (error) {
    console.error("Error generating economic analysis:", error);
    return [];
  }
}
