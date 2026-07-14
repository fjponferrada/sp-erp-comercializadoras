import { prisma } from './src/lib/prisma';

async function main() {
  const refDate = new Date(`2026-07-14T00:00:00.000Z`);
  const losses = await prisma.regulatedCost.findMany({
    where: {
      OR: [{ tariff: '3.0TD' }, { tariff: 'TODAS' }],
      validFrom: { lte: refDate },
      validTo: { gte: refDate },
      concept: { in: ['PERDIDAS', 'Perdidas'] }
    }
  });
  
  console.log("Losses 2026 3.0TD:", losses);
}

main().catch(console.error).finally(() => prisma.$disconnect());
