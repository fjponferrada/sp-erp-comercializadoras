import { prisma } from './src/lib/prisma';

async function main() {
  const costs = await prisma.regulatedCost.findMany({
    where: { OR: [{ tariff: '2.0TD' }, { tariff: 'TODAS' }] }
  });
  console.dir(costs, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
