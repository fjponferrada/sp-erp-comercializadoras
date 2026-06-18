import { prisma } from '../src/lib/prisma';

async function main() {
  const vipContracts = await prisma.contract.count({
    where: { status: 'ACTIVO', supplyPoint: { segment: 'VIP' } }
  });
  console.log('Active VIP contracts:', vipContracts);

  const vipCurves = await prisma.aggregatedLoadCurve.count({
    where: { segment: 'VIP' }
  });
  console.log('Total VIP Curves in DB:', vipCurves);
}

main().finally(() => prisma.$disconnect());
