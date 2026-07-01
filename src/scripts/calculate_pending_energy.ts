import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';

async function main() {
  console.log('Iniciando cálculo de energía pendiente...');
  const today = new Date();
  const endRange = endOfMonth(today);
  const startRange = startOfMonth(subMonths(today, 11));

  // 1. Fetch ReganecuData for CAD, total: true, matricial: false
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

  // 3. Fetch SystemComponentPrice for Losses, OMIE, OS, RESTRICCIONES
  const prices = await prisma.systemComponentPrice.findMany({
    where: {
      date: { gte: startRange, lte: endRange },
      component: { in: ['OMIE', 'OS', 'RESTRICCIONES', 'PERD_20TD', 'PERD_30TD', 'PERD_61TD'] }
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

    // Fetch matricial ReganecuData for this month and this closure to extract DSV prices
    const reganecuMatricialRecords = await prisma.reganecuData.findMany({
      where: {
        date: { gte: currentMonthStart, lte: currentMonthEnd },
        cierre: cierreBase,
        matricial: true,
        resolution: 'H' // Focus on hourly first, maybe fallback later if needed
      }
    });

    const dsvPriceByDayPeriod = new Map<string, number>();
    
    for (const matRecord of reganecuMatricialRecords) {
      const dayKey = format(matRecord.date, 'yyyy-MM-dd');
      const jData = matRecord.jsonData as any[];
      if (Array.isArray(jData)) {
        // We aggregate energy and cost by period to get price
        const aggByPeriod: Record<number, { e: number, c: number }> = {};
        for (const item of jData) {
          if (item.concept === 'DSV' || item.concept === 'DVS') {
            const period = item.period;
            if (!aggByPeriod[period]) aggByPeriod[period] = { e: 0, c: 0 };
            aggByPeriod[period].e += (item.energyVentas || 0) + (item.energyCompras || 0);
            aggByPeriod[period].c += (item.costDerechos || 0) + (item.costObligaciones || 0);
          }
        }
        for (const p of Object.keys(aggByPeriod)) {
          const period = parseInt(p);
          const data = aggByPeriod[period];
          let price = 0;
          if (data.e > 0) {
            price = data.c / data.e;
          }
          dsvPriceByDayPeriod.set(`${dayKey}_${period}`, price);
        }
      }
    }

    let estimatedBcMwh = 0;
    let estimatedCostEur = 0;

    for (let d = currentMonthStart.getDate(); d <= currentMonthEnd.getDate(); d++) {
      const dateObj = new Date(currentMonthStart);
      dateObj.setDate(d);
      const dayKey = format(dateObj, 'yyyy-MM-dd');

      const consumption = dailyConsumptionBySegment.get(dayKey);
      if (!consumption) continue;

      const omie = pricesByDateComponent.get(`${dayKey}_OMIE`) || Array(24).fill(0);
      const os = pricesByDateComponent.get(`${dayKey}_OS`) || Array(24).fill(0);
      const restricciones = pricesByDateComponent.get(`${dayKey}_RESTRICCIONES`) || Array(24).fill(0);
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

        estimatedBcMwh += hBcMwh;

        const period = h + 1; // reganecu periods are 1-indexed (1-24)
        const dsvPrice = dsvPriceByDayPeriod.get(`${dayKey}_${period}`) || 0;

        const hPrice = (omie[h] || 0) + (os[h] || 0) + (restricciones[h] || 0) + dsvPrice;
        estimatedCostEur += (hBcMwh * hPrice);
      }
    }

    // 5. Get Liquidated Energy (CAD component) from Reganecu
    let liquidatedMwh = 0;
    
    if (regRecord && regRecord.jsonData) {
      const jData = regRecord.jsonData as any;
      
      // If we have 'CAD' in the aggregated TOTAL records
      if (jData.CAD && jData.CAD.energyCompras) {
         liquidatedMwh = jData.CAD.energyCompras + (jData.CAD.energyVentas || 0);
      } else if (Array.isArray(jData.energia)) {
         liquidatedMwh = jData.energia.reduce((a: number, b: number) => a + (b || 0), 0);
      }
    }

    const pendingMwh = estimatedBcMwh - liquidatedMwh;
    
    let estimatedPendingCostEur = 0;
    if (estimatedBcMwh > 0) {
      estimatedPendingCostEur = (pendingMwh / estimatedBcMwh) * estimatedCostEur;
    }

    // Upsert to PendingEnergySummary
    await prisma.pendingEnergySummary.upsert({
      where: { month: monthKey },
      update: {
        cierre: cierreBase,
        estimatedBcMwh,
        liquidatedMwh,
        pendingMwh,
        estimatedPendingCostEur
      },
      create: {
        month: monthKey,
        cierre: cierreBase,
        estimatedBcMwh,
        liquidatedMwh,
        pendingMwh,
        estimatedPendingCostEur
      }
    });

    console.log(`✅ Mes ${monthKey} procesado. Cierre: ${cierreBase}. Pendiente MWh: ${pendingMwh.toFixed(2)}`);
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
