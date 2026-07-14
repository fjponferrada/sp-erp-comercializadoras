import { prisma } from './src/lib/prisma';

async function main() {
  const costs = await prisma.regulatedCost.findMany({
    where: { concept: { contains: 'REACTIVA' } }
  });
  console.log(costs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
