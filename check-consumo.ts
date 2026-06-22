import { prisma } from './src/lib/prisma';

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { contractCode: 'NUEB26331151QW0F' },
    orderBy: { version: 'asc' },
    include: { supplyPoint: true }
  });

  for (const c of contracts) {
    console.log(`Version: ${c.version}, Consumo: ${c.supplyPoint.annualConsumption}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
