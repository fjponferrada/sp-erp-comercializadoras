import { prisma } from '../src/lib/prisma';

async function main() {
  const contract = await prisma.contract.findFirst({
    where: { commissionBase: { gt: 0 } },
    select: { contractCode: true, commissionBase: true, supplyPoint: { select: { annualConsumption: true } } }
  });
  console.log('Contract with commissionBase:', contract);
}
main().finally(() => prisma.$disconnect());
