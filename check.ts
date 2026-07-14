import { prisma } from './src/lib/prisma';

async function main() {
  const c = await prisma.contract.findMany({
    where: { supplyPoint: { cups: { startsWith: 'ES0031101488239001JT' } } },
    select: { id: true, contractCode: true, status: true, terminationDate: true, requestDate: true, fechaPrevistaBaja: true }
  });
  console.log(JSON.stringify(c, null, 2));
}

main().finally(() => prisma.$disconnect());
