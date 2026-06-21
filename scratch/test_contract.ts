import { prisma } from '../src/lib/prisma';

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { contractCode: 'PRPR251151925PH0F' },
    select: {
      id: true,
      version: true,
      tramitationType: true,
      activationDate: true,
      commissionFinal: true
    },
    orderBy: { version: 'asc' }
  });

  console.log('Contracts for PRPR251151925PH0F:', JSON.stringify(contracts, null, 2));
}

main().finally(() => prisma.$disconnect());
