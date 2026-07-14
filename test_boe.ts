import { prisma } from './src/lib/prisma';

async function main() {
  const costs = await prisma.regulatedCost.findMany({
    where: {
      tariff: '2.0TD'
    },
    orderBy: { validFrom: 'desc' }
  });

  for (const c of costs) {
    console.log(c.concept, c.validFrom, "P1:", c.p1, "P2:", c.p2, "P3:", c.p3);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
