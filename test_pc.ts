import { prisma } from './src/lib/prisma';

async function main() {
  const years = [2025, 2026];
  for (const year of years) {
    const refDate = new Date(`${year}-07-14T00:00:00.000Z`);
    const refRegCosts = await prisma.regulatedCost.findMany({
      where: {
        OR: [{ tariff: '3.0TD' }, { tariff: 'TODAS' }],
        validFrom: { lte: refDate },
        validTo: { gte: refDate }
      }
    });
    
    const pc = refRegCosts.find(r => r.concept === 'Pagos_Capacidad' || r.concept === 'PC' || r.concept === 'CAPACIDAD');
    const fnee = refRegCosts.find(r => r.concept === 'FNEE');
    
    console.log(`--- ${year} ---`);
    console.log("PC P3:", pc?.p3);
    console.log("PC P4:", pc?.p4);
    console.log("FNEE:", fnee?.p1); // single value
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
