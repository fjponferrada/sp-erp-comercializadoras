import { prisma } from './src/lib/prisma';

async function main() {
  const costs = await prisma.regulatedCost.findMany({
    where: {
      tariff: '3.0TD',
      concept: { in: ['PEAJES_POTENCIA', 'CARGOS_POTENCIA'] }
    },
    orderBy: { validFrom: 'desc' }
  });

  for (const c of costs) {
    console.log(c.concept, c.validFrom, "P1:", c.p1, "P2:", c.p2, "P3:", c.p3, "P4:", c.p4, "P5:", c.p5, "P6:", c.p6);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
