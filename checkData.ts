import { prisma } from './src/lib/prisma';
async function run() {
  const comp = await prisma.company.findFirst({ where: { name: { contains: 'AED' } } });
  const count = await prisma.aggregatedLoadCurve.count();
  console.log("Total AggregatedLoadCurve:", count);
}
run().finally(() => prisma.$disconnect());
