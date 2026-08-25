import { prisma } from '../src/lib/prisma';
async function run() {
  const kMay = await prisma.systemComponentPrice.count({where: {component: 'K', date: {gte: new Date('2026-05-01'), lt: new Date('2026-06-01')}}});
  const kJune = await prisma.systemComponentPrice.count({where: {component: 'K', date: {gte: new Date('2026-06-01'), lt: new Date('2026-07-01')}}});
  const kJuly = await prisma.systemComponentPrice.count({where: {component: 'K', date: {gte: new Date('2026-07-01'), lt: new Date('2026-08-01')}}});
  console.log({may: kMay, june: kJune, july: kJuly});
}
run().finally(()=>prisma.$disconnect());
