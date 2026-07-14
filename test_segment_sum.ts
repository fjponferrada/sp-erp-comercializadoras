import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';

async function check() {
  const currentMonthStart = new Date('2026-03-01T00:00:00Z');
  const currentMonthEnd = endOfMonth(currentMonthStart);
  
  const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
    where: { date: { gte: currentMonthStart, lte: currentMonthEnd } }
  });
  
  let total20TD = 0;
  let totalOther = 0;
  
  for (const curve of aggregatedCurves) {
    let sum = 0;
    for (let h = 0; h < 24; h++) {
      if (curve.totalConsumption[h]) {
        sum += curve.totalConsumption[h];
      }
    }
    if (curve.segment === '2.0TD') {
      total20TD += sum;
    } else {
      totalOther += sum;
    }
  }
  
  console.log('Total 2.0TD MWh:', total20TD / 1000);
  console.log('Total Other MWh:', totalOther / 1000);
}
check().finally(() => prisma.$disconnect());
