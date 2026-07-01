import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';
import { getPeriodoREE } from '../lib/services/InternalBillingEngine';

export async function runCalculatePendingEnergy() {
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

  // 3. Fetch SystemComponentPrice for Losses, OS, RESTRICCIONES
  const prices = await prisma.systemComponentPrice.findMany({
    where: {
      date: { gte: startRange, lte: endRange },
      component: { in: ['OS', 'RESTRICCIONES', 'K', 'PERD_20TD', 'PERD_30TD', 'PERD_61TD'] }
    }
  });

  const pricesByDateComponent = new Map<string, number[]>();
  for (const price of prices) {
    const dayKey = format(price.date, 'yyyy-MM-dd');
    pricesByDateComponent.set(`${dayKey}_${price.component}`, price.values);
  }

  // Fetch BOE Perdidas from RegulatedCost
  const perdidasBOE = await prisma.regulatedCost.findMany({
    where: { concept: 'PERDIDAS' }
  });
  const boeByTariff = new Map<string, any>();
  for (const b of perdidasBOE) {
    boeByTariff.set(b.tariff, b);
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
        resolution: { in: ['H', 'QH'] }
      },
    });

    const dsvPriceByDayPeriod = new Map<string, number>();
    const cadEnergyByDayPeriod = new Map<string, number>();
    
    for (const matRecord of reganecuMatricialRecords) {
      const dayKey = format(matRecord.date, 'yyyy-MM-dd');
      const jData = matRecord.jsonData as any[];
      if (!Array.isArray(jData)) continue;

      if (matRecord.resolution === 'H' || matRecord.resolution === 'QH') {
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

      const os = pricesByDateComponent.get(`${dayKey}_OS`) || Array(24).fill(0);
      const restricciones = pricesByDateComponent.get(`${dayKey}_RESTRICCIONES`) || Array(24).fill(0);
      const perd20 = pricesByDateComponent.get(`${dayKey}_PERD_20TD`);
      const perd30 = pricesByDateComponent.get(`${dayKey}_PERD_30TD`);
      const perd61 = pricesByDateComponent.get(`${dayKey}_PERD_61TD`);
      const kFactor = pricesByDateComponent.get(`${dayKey}_K`) || Array(24).fill(1);
      
      // Helper function to get exact loss percentage for an hour
      const getLossForHour = (tariff: string, h: number, oldPerdArray: number[] | undefined) => {
        // Fallback to exactly calculated old PERD if BOE or K is missing
        const boe = boeByTariff.get(tariff);
        if (!boe) return oldPerdArray ? oldPerdArray[h] : 0;
        
        const dateObjH = new Date(dateObj);
        dateObjH.setUTCHours(h);
        const periodStr = getPeriodoREE(dateObjH, tariff); // P1, P2...
        const pVal = boe[periodStr.toLowerCase() as keyof typeof boe] as number | null;
        if (pVal === null || pVal === undefined) return oldPerdArray ? oldPerdArray[h] : 0;
        
        return pVal * kFactor[h];
      };

      for (let h = 0; h < 24; h++) {
        let hBcMwh = 0;
        
        const p20 = getLossForHour('2.0TD', h, perd20);
        const p30 = getLossForHour('3.0TD', h, perd30);
        const p61 = getLossForHour('6.1TD', h, perd61);

        if (consumption['2.0TD'] && consumption['2.0TD'][h]) {
          hBcMwh += (consumption['2.0TD'][h] / 1000) * (1 + (p20 > 2.0 ? p20/100 : p20));
        }
        if (consumption['3.0TD'] && consumption['3.0TD'][h]) {
          hBcMwh += (consumption['3.0TD'][h] / 1000) * (1 + (p30 > 2.0 ? p30/100 : p30));
        }
        if (consumption['3.0TDVE'] && consumption['3.0TDVE'][h]) {
          hBcMwh += (consumption['3.0TDVE'][h] / 1000) * (1 + (p30 > 2.0 ? p30/100 : p30));
        }
        if (consumption['6.1TD'] && consumption['6.1TD'][h]) {
          hBcMwh += (consumption['6.1TD'][h] / 1000) * (1 + (p61 > 2.0 ? p61/100 : p61));
        }

        for (const seg of Object.keys(consumption)) {
          if (!['2.0TD', '3.0TD', '3.0TDVE', '6.1TD'].includes(seg) && consumption[seg][h]) {
            hBcMwh += (consumption[seg][h] / 1000) * (1 + (p20 > 2.0 ? p20/100 : p20));
          }
        }

        const period = h + 1; // reganecu periods are 1-indexed (1-24)
        
        const hLiquidatedMwh = cadEnergyByDayPeriod.get(`${dayKey}_${period}`) || 0;
        const hDsvPrice = dsvPriceByDayPeriod.get(`${dayKey}_${period}`) || dsvPriceByDayPeriod.get(`${dayKey}_0`) || 0;
        
        const hPendingMwh = hBcMwh - hLiquidatedMwh;
        // Cost incorporates OS and RESTRICCIONES along with DSV price
        const hPrice = hDsvPrice + (os[h] || 0) + (restricciones[h] || 0);
        const hPendingCostEur = hPendingMwh * hPrice;

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


if (require.main === module) {
  runCalculatePendingEnergy()
    .catch((e) => {
      console.error('Error calculando:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

