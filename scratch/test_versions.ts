import { prisma } from '../src/lib/prisma';

async function main() {
  const cloned = await prisma.contract.findMany({
    where: { version: { gt: 0 } },
    take: 5,
    select: {
      id: true,
      contractCode: true,
      version: true,
      tramitationType: true,
      previousContractId: true
    }
  });
  console.log('Cloned contracts:', cloned);
}

main().finally(() => prisma.$disconnect());
