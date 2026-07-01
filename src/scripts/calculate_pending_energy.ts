import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';

async function main() {
  console.log('Iniciando cálculo de energía pendiente con cálculo horario exacto...');
  const today = new Date();
  const endRange = endOfMonth(today);
  const startRange = startOfMonth(subMonths(today, 11));

  // 1. Fetch ReganecuData for CAD, total: true, matricial: false to find the latest closure
  const reganecuRecords = await prisma.reganecuData.findMany({
    where: {
      date: { gte: startRange, lte: endRange },
      total: true,
      matricial: false
    },
    orderBy: [
      { date: 'desc' },
      { cierre: 'desc' }
    ]
  });

  const reganecuByMonth = new Map<string, any>();
  for (const record of reganecuRecords) {
    const monthKey = format(record.date, 'yyyy-MM');
    if (!reganecuByMonth.has(monthKey)) {
      reganecuByMonth.set(monthKey, record);
    }
  }

  // 2. Fetch AggregatedLoadCurve for the period
  const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
    where: {
      date: { gte: startRange, lte: endRange }
    }
  });

  const dailyConsumptionBySegment = new Map<string, Record<string, number[]>>();
  for (const curve of aggregatedCurves) {
    const dayKey = format(curve.date, 'yyyy-MM-dd');
    if (!dailyConsumptionBySegment.has(dayKey)) {
      dailyConsumptionBySegment.set(dayKey, {});
    }
    const dayMap = dailyConsumptionBySegment.get(dayKey)!;
    
    const segment = curve.segment;
    if (!dayMap[segment]) {
      dayMap[segment] = Array(24).fill(0);
    }
    
    for (let h = 0; h < 24; h++) {
      if (curve.totalConsumption[h]) {
        dayMap[segment][h] += curve.totalConsumption[h];
      }
    }
  }

  // 3. Fetch SystemComponentPrice for Losses
  const prices = await prisma.systemComponentPrice.findMany({
    where: {
      date: { gte: startRange, lte: endRange },
      component: { in: ['PERD_20TD', 'PERD_30TD', 'PERD_61TD'] }
    }
  });

  const pricesByDateComponent = new Map<string, number[]>();
  for (const price of prices) {
    const dayKey = format(price.date, 'yyyy-MM-dd');
    pricesByDateComponent.set(`${dayKey}_${price.component}`, price.values);
  }

  // 4. Calculate for each month
  for (let i = 11; i >= 0; i--) {
    const currentMonthStart = startOfMonth(subMonths(today, i));
    const currentMonthEnd = endOfMonth(currentMonthStart);
    const monthKey = format(currentMonthStart, 'yyyy-MM');

    // Get the base closure for the month
    const regRecord = reganecuByMonth.get(monthKey);
    let cierreBase = 'N/A';
    if (regRecord && regRecord.jsonData) {
      cierreBase = regRecord.cierre;
    }

    // Fetch matricial ReganecuData for this month and this closure to extract DSV prices and CAD energy
    const reganecuMatricialRecords = await prisma.reganecuData.findMany({
      where: {
        date: { gte: currentMonthStart, lte: currentMonthEnd },
        cierre: cierreBase,
        matricial: true,
        resolution: 'H'
      }
    });

    const dsvPriceByDayPeriod = new Map<string, number>();
    const cadEnergyByDayPeriod = new Map<string, number>();
    
    for (const matRecord of reganecuMatricialRecords) {
      const dayKey = format(matRecord.date, 'yyyy-MM-dd');
      const jData = matRecord.jsonData as any[];
      if (Array.isArray(jData)) {
        const aggDsv: Record<number, { e: number, c: number }> = {};
        const aggCad: Record<number, number> = {};
        
        for (const item of jData) {
          const period = item.period;
          if (item.concept === 'DSV' || item.concept === 'DVS') {
            if (!aggDsv[period]) aggDsv[period] = { e: 0, c: 0 };
            aggDsv[period].e += (item.energyVentas || 0) + (item.energyCompras || 0);
            aggDsv[period].c += (item.costDerechos || 0) + (item.costObligaciones || 0);
          } else if (item.concept === 'CAD') {
            if (!aggCad[period]) aggCad[period] = 0;
            aggCad[period] += (item.energyVentas || 0) + (item.energyCompras || 0);
          }
        }
        
        for (const p of Object.keys(aggDsv)) {
          const period = parseInt(p);
          const data = aggDsv[period];
          let price = 0;
          if (data.e > 0) {
            price = data.c / data.e;
          }
          dsvPriceByDayPeriod.set(`${dayKey}_${period}`, price);
        }
        
        for (const p of Object.keys(aggCad)) {
          cadEnergyByDayPeriod.set(`${dayKey}_${p}`, aggCad[parseInt(p)]);
        }
      }
    }

    let totalEstimatedBcMwh = 0;
    let totalLiquidatedMwh = 0;
    let totalPendingMwh = 0;
    let totalEstimatedPendingCostEur = 0;

    for (let d = currentMonthStart.getDate(); d <= currentMonthEnd.getDate(); d++) {
      const dateObj = new Date(currentMonthStart);
      dateObj.setDate(d);
      const dayKey = format(dateObj, 'yyyy-MM-dd');

      const consumption = dailyConsumptionBySegment.get(dayKey);
      if (!consumption) continue;

      const perd20 = pricesByDateComponent.get(`${dayKey}_PERD_20TD`) || Array(24).fill(0);
      const perd30 = pricesByDateComponent.get(`${dayKey}_PERD_30TD`) || Array(24).fill(0);
      const perd61 = pricesByDateComponent.get(`${dayKey}_PERD_61TD`) || Array(24).fill(0);

      for (let h = 0; h < 24; h++) {
        let hBcMwh = 0;
        
        if (consumption['2.0TD'] && consumption['2.0TD'][h]) {
          hBcMwh += (consumption['2.0TD'][h] / 1000) * (1 + (perd20[h] > 2.0 ? perd20[h]/100 : perd20[h]));
        }
        if (consumption['3.0TD'] && consumption['3.0TD'][h]) {
          hBcMwh += (consumption['3.0TD'][h] / 1000) * (1 + (perd30[h] > 2.0 ? perd30[h]/100 : perd30[h]));
        }
        if (consumption['3.0TDVE'] && consumption['3.0TDVE'][h]) {
          hBcMwh += (consumption['3.0TDVE'][h] / 1000) * (1 + (perd30[h] > 2.0 ? perd30[h]/100 : perd30[h]));
        }
        if (consumption['6.1TD'] && consumption['6.1TD'][h]) {
          hBcMwh += (consumption['6.1TD'][h] / 1000) * (1 + (perd61[h] > 2.0 ? perd61[h]/100 : perd61[h]));
        }

        for (const seg of Object.keys(consumption)) {
          if (!['2.0TD', '3.0TD', '3.0TDVE', '6.1TD'].includes(seg) && consumption[seg][h]) {
            hBcMwh += (consumption[seg][h] / 1000) * (1 + (perd20[h] > 2.0 ? perd20[h]/100 : perd20[h]));
          }
        }

        const period = h + 1; // reganecu periods are 1-indexed (1-24)
        
        const hLiquidatedMwh = cadEnergyByDayPeriod.get(`${dayKey}_${period}`) || 0;
        const hDsvPrice = dsvPriceByDayPeriod.get(`${dayKey}_${period}`) || 0;
        
        const hPendingMwh = hBcMwh - hLiquidatedMwh;
        const hPendingCostEur = hPendingMwh * hDsvPrice;

        totalEstimatedBcMwh += hBcMwh;
        totalLiquidatedMwh += hLiquidatedMwh;
        totalPendingMwh += hPendingMwh;
        totalEstimatedPendingCostEur += hPendingCostEur;
      }
    }

    await prisma.pendingEnergySummary.upsert({
      where: { month: monthKey },
      update: {
        cierre: cierreBase,
        estimatedBcMwh: totalEstimatedBcMwh,
        liquidatedMwh: totalLiquidatedMwh,
        pendingMwh: totalPendingMwh,
        estimatedPendingCostEur: totalEstimatedPendingCostEur
      },
      create: {
        month: monthKey,
        cierre: cierreBase,
        estimatedBcMwh: totalEstimatedBcMwh,
        liquidatedMwh: totalLiquidatedMwh,
        pendingMwh: totalPendingMwh,
        estimatedPendingCostEur: totalEstimatedPendingCostEur
      }
    });

    console.log(`✅ Mes ${monthKey} procesado. Cierre: ${cierreBase}. Pendiente MWh: ${totalPendingMwh.toFixed(2)} | Coste: ${totalEstimatedPendingCostEur.toFixed(2)}€`);
  }

  console.log('Cálculo finalizado exitosamente.');
}

main()
  .catch((e) => {
    console.error('Error calculando:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
