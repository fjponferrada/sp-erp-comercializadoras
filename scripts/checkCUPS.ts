import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const count = await prisma.loadCurve.groupBy({
    by: ['date'],
    _count: { cups: true },
    where: { date: { gte: new Date('2025-08-01T00:00:00Z'), lte: new Date('2025-08-31T23:59:59Z') } },
    orderBy: { date: 'asc' }
  });
  console.log("August CUPS count per day:");
  count.forEach(c => console.log(c.date.toISOString().split('T')[0] + ' : ' + c._count.cups));

  const novCount = await prisma.loadCurve.groupBy({
    by: ['date'],
    _count: { cups: true },
    where: { date: { gte: new Date('2025-11-01T00:00:00Z'), lte: new Date('2025-11-30T23:59:59Z') } },
    orderBy: { date: 'asc' }
  });
  console.log("November CUPS count per day:");
  novCount.forEach(c => console.log(c.date.toISOString().split('T')[0] + ' : ' + c._count.cups));

  await prisma.$disconnect();
}
main();
