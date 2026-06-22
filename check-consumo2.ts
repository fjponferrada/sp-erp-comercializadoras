import { prisma } from './src/lib/prisma';

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { contractCode: 'NUEB26331151QW0F' },
    orderBy: { version: 'asc' },
    include: { supplyPoint: true, lead: true }
  });

  for (const c of contracts) {
    console.log(`Version: ${c.version}, Consumo SP: ${c.supplyPoint.annualConsumption}, Consumo Lead: ${c.lead?.estimatedMWh}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
