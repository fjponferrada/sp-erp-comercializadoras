import { prisma } from '../src/lib/prisma';
async function run() {
  console.log('With segment:', await prisma.supplyPoint.count({ where: { segment: { not: null } } }));
  console.log('Total:', await prisma.supplyPoint.count());
}
run().then(() => prisma.$disconnect());
