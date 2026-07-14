import { prisma } from '../src/lib/prisma';
async function main() {
  const fs = await prisma.f1Invoice.findMany({
    where: { supplyPoint: { cups: { contains: 'ES0031105546437024DF0F' } } },
    select: { id: true, startDate: true, endDate: true }
  });
  console.log(fs);
}
main().finally(() => prisma.$disconnect());
