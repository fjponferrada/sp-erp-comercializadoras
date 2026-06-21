import { prisma } from '../src/lib/prisma';

async function main() {
  const contract = await prisma.contract.findMany({
    where: { contractCode: { startsWith: 'GOJL2658115247AM' } },
    select: {
      id: true,
      contractCode: true,
      version: true,
      status: true,
      activationDate: true,
      terminationDate: true,
      commissionFinal: true,
      userId: true,
      brandId: true,
      tramitationType: true,
      user: { select: { channelId: true, channel: { select: { name: true } } } }
    }
  });

  console.log('Contract Info:', JSON.stringify(contract, null, 2));
}

main().finally(() => prisma.$disconnect());
