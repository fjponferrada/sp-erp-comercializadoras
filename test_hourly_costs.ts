import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { format, startOfMonth, subMonths, endOfMonth } from 'date-fns';
import { getPeriodoREE } from './src/lib/services/InternalBillingEngine';

async function main() {
  const currentMonthStart = new Date('2026-03-01T00:00:00Z');
  const currentMonthEnd = new Date('2026-03-31T23:59:59Z');

  const reganecuMatricialRecords = await prisma.reganecuData.findMany({
    where: {
      date: { gte: currentMonthStart, lte: currentMonthEnd },
      cierre: 'C2',
      matricial: true,
      resolution: { in: ['H', 'QH'] }
    }
  });

  const dsvPriceSubirByDayPeriod = new Map<string, number>();
  const dsvPriceBajarByDayPeriod = new Map<string, number>();
  const cadEnergyByDayPeriod = new Map<string, number>();

  let totalECompras = 0;
  let totalCOblig = 0;
  let totalEVentas = 0;
  let totalCDerechos = 0;

  for (const matRecord of reganecuMatricialRecords) {
    const jData = matRecord.jsonData as any[];
    if (!Array.isArray(jData)) continue;
    for (const item of jData) {
      if (item.concept === 'DSV' || item.concept === 'DVS') {
        totalEVentas += (item.energyVentas || 0);
        totalCDerechos += (item.costDerechos || 0);
        totalECompras += (item.energyCompras || 0);
        totalCOblig += (item.costObligaciones || 0);
      }
    }
  }

  const defaultPriceSubir = totalECompras > 0 ? totalCOblig / totalECompras : 0;
  const defaultPriceBajar = totalEVentas > 0 ? totalCDerechos / totalEVentas : 0;

  for (const matRecord of reganecuMatricialRecords) {
    const dayKey = format(matRecord.date, 'yyyy-MM-dd');
    const jData = matRecord.jsonData as any[];
    if (!Array.isArray(jData)) continue;

    const aggDsv: Record<number, { eV: number, cD: number, eC: number, cO: number }> = {};
    const aggCad: Record<number, number> = {};
    
    for (const item of jData) {
      const period = item.period;
      if (item.concept === 'DSV' || item.concept === 'DVS') {
        if (!aggDsv[period]) aggDsv[period] = { eV: 0, cD: 0, eC: 0, cO: 0 };
        aggDsv[period].eV += (item.energyVentas || 0);
        aggDsv[period].cD += (item.costDerechos || 0);
        aggDsv[period].eC += (item.energyCompras || 0);
        aggDsv[period].cO += (item.costObligaciones || 0);
      } else if (item.concept === 'CAD') {
        if (!aggCad[period]) aggCad[period] = 0;
        aggCad[period] += (item.energyVentas || 0) + (item.energyCompras || 0);
      }
    }
    
    for (const p of Object.keys(aggDsv)) {
      const period = parseInt(p);
      const data = aggDsv[period];
      let pSubir = data.eC > 0 ? data.cO / data.eC : defaultPriceSubir;
      let pBajar = data.eV > 0 ? data.cD / data.eV : defaultPriceBajar;

      dsvPriceSubirByDayPeriod.set(`${dayKey}_${period}`, pSubir);
      dsvPriceBajarByDayPeriod.set(`${dayKey}_${period}`, pBajar);
    }
    
    for (const p of Object.keys(aggCad)) {
      cadEnergyByDayPeriod.set(`${dayKey}_${p}`, aggCad[parseInt(p)]);
    }
  }

  const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
    where: {
      date: { gte: currentMonthStart, lte: currentMonthEnd }
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

  let totalCost = 0;
  let totalBc = 0;
  let totalLiq = 0;
  
  for (let d = currentMonthStart.getDate(); d <= currentMonthEnd.getDate(); d++) {
    const dateObj = new Date(currentMonthStart);
    dateObj.setDate(d);
    const dayKey = format(dateObj, 'yyyy-MM-dd');

    const consumption = dailyConsumptionBySegment.get(dayKey);
    if (!consumption) continue;

    for (let h = 0; h < 24; h++) {
      let hBcMwh = 0;
      for (const seg of Object.keys(consumption)) {
        if (consumption[seg][h]) {
          hBcMwh += (consumption[seg][h] / 1000); // ignoring losses for this debug
        }
      }

      const period = h + 1;
      const hLiquidatedMwh = cadEnergyByDayPeriod.get(`${dayKey}_${period}`) || 0;
      
      const hDsvPriceSubir = dsvPriceSubirByDayPeriod.get(`${dayKey}_${period}`) || dsvPriceSubirByDayPeriod.get(`${dayKey}_0`) || defaultPriceSubir;
      const hDsvPriceBajar = dsvPriceBajarByDayPeriod.get(`${dayKey}_${period}`) || dsvPriceBajarByDayPeriod.get(`${dayKey}_0`) || defaultPriceBajar;
      
      const hPendingMwh = hBcMwh - hLiquidatedMwh;
      
      let hDsvPrice = 0;
      if (hPendingMwh > 0) {
        hDsvPrice = hDsvPriceSubir;
      } else {
        hDsvPrice = hDsvPriceBajar;
      }

      const hPrice = hDsvPrice; // ignoring OS and RESTRICCIONES for debug
      const hPendingCostEur = hPendingMwh * hPrice;

      if (Math.abs(hPendingMwh) > 5) { // Log large deviations
        console.log(`${dayKey} H${h}: Pend=${hPendingMwh.toFixed(2)} MWh (BC=${hBcMwh.toFixed(2)}, Liq=${hLiquidatedMwh.toFixed(2)}) x Price=${hPrice.toFixed(2)} = Cost=${hPendingCostEur.toFixed(2)} Eur`);
      }

      totalCost += hPendingCostEur;
      totalBc += hBcMwh;
      totalLiq += hLiquidatedMwh;
    }
  }
  
  console.log(`Total BC: ${totalBc.toFixed(2)} MWh`);
  console.log(`Total Liq: ${totalLiq.toFixed(2)} MWh`);
  console.log(`Net Pend: ${(totalBc - totalLiq).toFixed(2)} MWh`);
  console.log(`Total Cost: ${totalCost.toFixed(2)} Eur`);

}
main().finally(() => prisma.$disconnect());
