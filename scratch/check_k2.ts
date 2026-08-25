import { prisma } from '../src/lib/prisma';
async function run() {
  const kJune = await prisma.systemComponentPrice.findFirst({where: {component: 'K', date: {gte: new Date('2026-06-01'), lt: new Date('2026-07-01')}}});
  const kJuly = await prisma.systemComponentPrice.findFirst({where: {component: 'K', date: {gte: new Date('2026-07-01'), lt: new Date('2026-08-01')}}});
  console.log('June version:', kJune?.version);
  console.log('July version:', kJuly?.version);
}
run().finally(()=>prisma.$disconnect());
