import { prisma } from '../src/lib/prisma';
async function run() {
  const kJune = await prisma.systemComponentPrice.findFirst({where: {component: 'K', date: {gte: new Date('2026-06-01'), lt: new Date('2026-07-01')}}});
  console.log('June K values:', kJune?.values?.slice(0, 5));
}
run().finally(()=>prisma.$disconnect());
