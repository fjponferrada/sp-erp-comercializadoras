import { prisma } from './src/lib/prisma';

async function main() {
  const refDate = new Date('2025-07-14T00:00:00.000Z');
  const refRegCosts = await prisma.regulatedCost.findMany({
    where: {
      OR: [{ tariff: '3.0TD' }, { tariff: 'TODAS' }],
      validFrom: { lte: refDate },
      validTo: { gte: refDate }
    }
  });
  const peajes = refRegCosts.find(r => r.concept === 'Peajes_Energia');
  const cargos = refRegCosts.find(r => r.concept === 'Cargos_Energia');
  console.log("Peajes:", peajes);
  console.log("Cargos:", cargos);
}

main().catch(console.error).finally(() => prisma.$disconnect());
