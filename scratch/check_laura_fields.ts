import { prisma } from '../src/lib/prisma';

async function main() {
  const c = await prisma.contract.findFirst({
    where: { client: { businessName: { contains: 'LAURA ALOS' } } },
    select: {
      id: true,
      fee: true,
      feeExcedentes: true,
      pexc: true,
      deviationCost: true,
      product: {
        select: {
          fee: true,
          feeExcedentes: true,
          pexc: true,
          deviationCost: true,
        }
      }
    }
  });
  console.log(JSON.stringify(c, null, 2));
}

main().finally(() => prisma.$disconnect());
