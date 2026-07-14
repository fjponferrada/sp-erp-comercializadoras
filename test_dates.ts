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

  let totalInMap = 0;
  for (let d = 1; d <= 31; d++) {
    const dateObj = new Date(currentMonthStart);
    dateObj.setDate(d);
    const dayKey = format(dateObj, 'yyyy-MM-dd');
    const consumption = dailyConsumptionBySegment.get(dayKey);
    if (!consumption) continue;
    
    for (const seg of Object.keys(consumption)) {
      for (let h=0; h<24; h++) {
        totalInMap += consumption[seg][h];
      }
    }
  }
  
  console.log('Total aggregated load curve query:', aggregatedCurves.reduce((a, b) => a + b.totalConsumption.reduce((x, y) => x + (y||0), 0), 0));
  console.log('Total retrieved via daily consumption map:', totalInMap);
}
main().finally(() => prisma.$disconnect());
