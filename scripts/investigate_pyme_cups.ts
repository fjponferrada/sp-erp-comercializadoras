import { prisma } from '../src/lib/prisma';

async function main() {
  const points = await prisma.supplyPoint.findMany({
    where: { segment: { startsWith: 'HOGAR' } },
    take: 10,
    select: { cups: true, annualConsumption: true, segment: true, tariff: true }
  });

  console.table(points);
}
main().finally(() => prisma.$disconnect());
