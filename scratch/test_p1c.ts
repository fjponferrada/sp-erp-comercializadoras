import { prisma } from '../src/lib/prisma';

async function main() {
  const contract = await prisma.contract.findFirst({
    where: { OR: [ { p1c: { gt: 0 } }, { p2c: { gt: 0 } } ] },
    select: { contractCode: true, p1c: true, p2c: true, p3c: true, p4c: true, p5c: true, p6c: true }
  });
  console.log('Contract with pxC:', contract);
}
main().finally(() => prisma.$disconnect());
