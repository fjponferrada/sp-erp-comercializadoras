const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const concepts = await prisma.regulatedCost.findMany({
    select: { concept: true },
    distinct: ['concept']
  });
  console.log("ALL DISTINCT CONCEPTS:");
  console.log(concepts.map(c => c.concept).join(', '));
}
main().catch(console.error).finally(() => prisma.$disconnect());

main().catch(console.error).finally(() => prisma.$disconnect());
