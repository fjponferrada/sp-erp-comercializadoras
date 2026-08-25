import { prisma } from '../src/lib/prisma';
async function run() {
  const kMay = await prisma.systemComponentPrice.findFirst({where: {component: 'K', date: {gte: new Date('2026-05-01'), lt: new Date('2026-06-01')}}});
  const kJune = await prisma.systemComponentPrice.findFirst({where: {component: 'K', date: {gte: new Date('2026-06-01'), lt: new Date('2026-07-01')}}});
  const kJuly = await prisma.systemComponentPrice.findFirst({where: {component: 'K', date: {gte: new Date('2026-07-01'), lt: new Date('2026-08-01')}}});
  console.log('May K values:', kMay?.values?.slice(0, 5));
  console.log('June K values:', kJune?.values?.slice(0, 5));
  console.log('July K values:', kJuly?.values?.slice(0, 5));
}
run().finally(()=>prisma.$disconnect());
