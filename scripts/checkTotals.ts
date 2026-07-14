import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const aug = await prisma.aggregatedLoadCurve.findMany({
    where: { date: { gte: new Date('2025-08-01T00:00:00Z'), lte: new Date('2025-08-31T23:59:59Z') } },
    orderBy: { date: 'asc' }
  });
  console.log('--- August ---');
  // Sum by day
  const augByDay = new Map<string, number>();
  for (const a of aug) {
    const d = a.date.toISOString().split('T')[0];
    const sum = (a.totalConsumption as number[]).reduce((s, v) => s + v, 0);
    augByDay.set(d, (augByDay.get(d) || 0) + sum);
  }
  for (const [d, sum] of augByDay.entries()) {
    console.log(d + ' : ' + sum.toFixed(2));
  }

  const nov = await prisma.aggregatedLoadCurve.findMany({
    where: { date: { gte: new Date('2025-11-01T00:00:00Z'), lte: new Date('2025-11-30T23:59:59Z') } },
    orderBy: { date: 'asc' }
  });
  console.log('--- November ---');
  const novByDay = new Map<string, number>();
  for (const a of nov) {
    const d = a.date.toISOString().split('T')[0];
    const sum = (a.totalConsumption as number[]).reduce((s, v) => s + v, 0);
    novByDay.set(d, (novByDay.get(d) || 0) + sum);
  }
  for (const [d, sum] of novByDay.entries()) {
    console.log(d + ' : ' + sum.toFixed(2));
  }

  await prisma.$disconnect();
}
main();
