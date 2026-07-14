import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';

async function main() {
  const today = new Date();
  const endRange = endOfMonth(today);
  const startRange = startOfMonth(subMonths(today, 11));

  const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
    where: {
      date: { gte: startRange, lte: endRange }
    }
  });

  const dailyConsumptionBySegment = new Map<string, Record<string, number[]>>();
  for (const curve of aggregatedCurves) {
    const dayKey = format(curve.date, 'yyyy-MM-dd');
    if (!dailyConsumptionBySegment.has(dayKey)) dailyConsumptionBySegment.set(dayKey, {});
    const dayMap = dailyConsumptionBySegment.get(dayKey)!;
    const segment = curve.segment;
    if (!dayMap[segment]) dayMap[segment] = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      if (curve.totalConsumption[h]) dayMap[segment][h] += curve.totalConsumption[h];
    }
  }

  const currentMonthStart = new Date('2026-03-01T00:00:00.000');
  const currentMonthEnd = endOfMonth(currentMonthStart);
  
  for (let d = currentMonthStart.getDate(); d <= currentMonthEnd.getDate(); d++) {
    const dateObj = new Date(currentMonthStart);
    dateObj.setDate(d);
    const dayKey = format(dateObj, 'yyyy-MM-dd');

    const consumption = dailyConsumptionBySegment.get(dayKey);
    let total = 0;
    if (consumption) {
       for (const seg of Object.keys(consumption)) {
          for(let h=0; h<24; h++) total += consumption[seg][h];
       }
    }
    console.log(dayKey, total);
  }

}
main().finally(() => prisma.$disconnect());
