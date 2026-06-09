import { prisma } from '../lib/prisma';

async function run() {
  const duplicateCups = await prisma.contract.groupBy({
    by: ['supplyPointId'],
    _count: {
      id: true
    },
    having: {
      id: {
        _count: {
          gt: 1
        }
      }
    }
  });

  console.log(`Puntos de suministro con más de un contrato: ${duplicateCups.length}`);
  for (const item of duplicateCups) {
     const sp = await prisma.supplyPoint.findUnique({ where: { id: item.supplyPointId }});
     const contracts = await prisma.contract.findMany({ where: { supplyPointId: item.supplyPointId }, select: { contractCode: true, status: true } });
     console.log(`CUPS: ${sp?.cups} -> Contratos:`, contracts.map(c => c.contractCode));
  }
}
run().finally(() => prisma.$disconnect());
