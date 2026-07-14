import { prisma } from '../src/lib/prisma';
async function run() {
  const r = await prisma.loadCurve.groupBy({ by: ['source'], _count: true });
  console.log(r);
}
run().then(() => prisma.$disconnect());
