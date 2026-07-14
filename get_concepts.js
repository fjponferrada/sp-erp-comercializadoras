const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const costs = await prisma.regulatedCost.findMany({
    select: { concept: true },
    distinct: ['concept']
  });
  console.log(costs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
