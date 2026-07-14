import { prisma } from './src/lib/prisma';

async function main() {
  await prisma.regulatedCost.updateMany({
    where: {
      concept: 'FNEE',
      tariff: '2.0TD',
      validFrom: { gte: new Date('2026-01-01') }
    },
    data: {
      p3: 0.002658
    }
  });
  console.log("Fixed 2.0TD FNEE P3 2026.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
