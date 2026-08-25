import { prisma } from '../src/lib/prisma';
async function run() {
  const kMay = await prisma.systemComponentPrice.findFirst({where: {component: 'K', date: {gte: new Date('2026-05-01'), lt: new Date('2026-06-01')}}});
  console.log('May K version:', kMay?.version);
}
run().finally(()=>prisma.$disconnect());
