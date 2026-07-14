import { prisma } from './src/lib/prisma';

async function main() {
  const fnees = await prisma.regulatedCost.findMany({
    where: { concept: 'FNEE' },
    orderBy: { validFrom: 'asc' }
  });
  console.log("FNEE RECORDS:");
  console.log(fnees);
}

main().catch(console.error).finally(() => prisma.$disconnect());
