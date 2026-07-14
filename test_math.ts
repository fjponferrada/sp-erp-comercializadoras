import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { startOfMonth, endOfMonth, format } from 'date-fns';

async function main() {
  const currentMonthStart = new Date('2026-03-01T00:00:00Z');
  const currentMonthEnd = endOfMonth(currentMonthStart);
  
  const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
    where: { date: { gte: currentMonthStart, lte: currentMonthEnd } }
  });

  const dailyConsumptionBySegment = new Map<string, Record<string, number[]>>();
  for (const curve of aggregatedCurves) {
    const dayKey = format(curve.date, 'yyyy-MM-dd');
    if (!dailyConsumptionBySegment.has(dayKey)) dailyConsumptionBySegment.set(dayKey, {});
    const dayMap = dailyConsumptionBySegment.get(dayKey)!;
    if (!dayMap[curve.segment]) dayMap[curve.segment] = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      if (curve.totalConsumption[h]) dayMap[curve.segment][h] += curve.totalConsumption[h];
    }
  }

  let totalMeterMwh = 0;
  let totalBcMwh = 0;

  for (let d = 1; d <= 31; d++) {
    const dateObj = new Date(currentMonthStart);
    dateObj.setDate(d);
    const dayKey = format(dateObj, 'yyyy-MM-dd');
    const consumption = dailyConsumptionBySegment.get(dayKey);
    if (!consumption) continue;
    
    // Assume flat 16.7% loss and 1.19 K for simplicity
    const p20 = 16.7 * 1.19; 
    
    for (let h = 0; h < 24; h++) {
      for (const seg of Object.keys(consumption)) {
        if (consumption[seg][h]) {
          totalMeterMwh += consumption[seg][h] / 1000;
          totalBcMwh += (consumption[seg][h] / 1000) * (1 + (p20 > 2.0 ? p20/100 : p20));
        }
      }
    }
  }
  
  console.log('Total Meter MWh:', totalMeterMwh);
  console.log('Total Estimated BC MWh:', totalBcMwh);
}

main().finally(() => prisma.$disconnect());
