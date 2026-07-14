import { prisma } from './src/lib/prisma';

async function main() {
  const years = [2024, 2025, 2026];
  for (const year of years) {
    const refDate = new Date(`${year}-07-14T00:00:00.000Z`);
    const refRegCosts = await prisma.regulatedCost.findMany({
      where: {
        tariff: '3.0TD',
        validFrom: { lte: refDate },
        validTo: { gte: refDate }
      }
    });
    const peajes = refRegCosts.find(r => r.concept === 'Peajes_Energia');
    const cargos = refRegCosts.find(r => r.concept === 'Cargos_Energia');
    console.log(`--- ${year} ---`);
    console.log("Peajes P3:", peajes?.p3);
    console.log("Cargos P3:", cargos?.p3);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
