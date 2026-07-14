import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const c = await prisma.loadCurve.groupBy({
    by: ['date'],
    _count: { _all: true },
    where: { date: { gte: new Date('2025-07-01'), lte: new Date('2025-07-05') } }
  });
  console.log("LoadCurve distinct dates in early July 2025:");
  console.log(c.map(x => `${x.date.toISOString()} - ${x._count._all}`));
}
main().finally(() => prisma.$disconnect());
