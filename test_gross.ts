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

  const cadEnergyByDayPeriod = new Map<string, number>();

  for (const matRecord of reganecuMatricialRecords) {
    const dayKey = format(matRecord.date, 'yyyy-MM-dd');
    const jData = matRecord.jsonData as any[];
    if (!Array.isArray(jData)) continue;

    const aggCad: Record<number, number> = {};
    for (const item of jData) {
      if (item.concept === 'CAD') {
        const period = item.period;
        if (!aggCad[period]) aggCad[period] = 0;
        aggCad[period] += (item.energyVentas || 0) + (item.energyCompras || 0);
      }
    }
    for (const p of Object.keys(aggCad)) {
      cadEnergyByDayPeriod.set(`${dayKey}_${p}`, aggCad[parseInt(p)]);
    }
  }

  const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
    where: {
      date: { gte: new Date('2026-02-20T00:00:00Z'), lte: new Date('2026-04-10T00:00:00Z') }
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
    if (!dayMap[segment]) dayMap[segment] = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      if (curve.totalConsumption[h]) {
        dayMap[segment][h] += curve.totalConsumption[h];
      }
    }
  }

  let totalGrossShort = 0;
  let totalGrossLong = 0;
  
  for (let d = currentMonthStart.getDate(); d <= currentMonthEnd.getDate(); d++) {
    const dateObj = new Date(currentMonthStart);
    dateObj.setDate(d);
    const dayKey = format(dateObj, 'yyyy-MM-dd');

    const consumption = dailyConsumptionBySegment.get(dayKey);
    // if (!consumption) console.log(`Missing BC for ${dayKey}`);
    
    for (let h = 0; h < 24; h++) {
      let hBcMwh = 0;
      if (consumption) {
        for (const seg of Object.keys(consumption)) {
          if (consumption[seg][h]) {
            hBcMwh += (consumption[seg][h] / 1000) * 1.15; // approximate losses
          }
        }
      }

      const period = h + 1;
      const hLiquidatedMwh = cadEnergyByDayPeriod.get(`${dayKey}_${period}`) || 0;
      
      const hPendingMwh = hBcMwh - hLiquidatedMwh;
      if (hPendingMwh > 0) totalGrossShort += hPendingMwh;
      else totalGrossLong += hPendingMwh;
    }
  }
  
  console.log(`Total Gross Short (+): ${totalGrossShort.toFixed(2)} MWh`);
  console.log(`Total Gross Long (-): ${totalGrossLong.toFixed(2)} MWh`);
  console.log(`Net Pending: ${(totalGrossShort + totalGrossLong).toFixed(2)} MWh`);

}
main().finally(() => prisma.$disconnect());
