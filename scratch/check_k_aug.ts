import { prisma } from '../src/lib/prisma';
async function run() {
  const kAug = await prisma.systemComponentPrice.count({where: {component: 'K', date: {gte: new Date('2026-08-01')}}});
  console.log('Aug K count:', kAug);
}
run().finally(()=>prisma.$disconnect());
