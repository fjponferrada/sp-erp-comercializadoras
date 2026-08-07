import { prisma } from '../lib/prisma';

async function main() {
  const currentMonthStart = new Date('2026-07-01T00:00:00Z');
  const currentMonthEnd = new Date('2026-07-31T23:59:59Z');

  const reganecuMatricialRecords = await prisma.reganecuData.findMany({
    where: {
      date: { gte: currentMonthStart, lte: currentMonthEnd },
      cierre: 'A2',
      matricial: true,
      resolution: { in: ['H', 'QH'] }
    },
  });

  let totalECompras = 0;
  let totalCOblig = 0;
  let totalEVentas = 0;
  let totalCDerechos = 0;

  for (const matRecord of reganecuMatricialRecords) {
    const jData = matRecord.jsonData as any[];
    if (!Array.isArray(jData)) continue;
    if (matRecord.resolution === 'H' || matRecord.resolution === 'QH') {
      for (const item of jData) {
        if (item.concept === 'DSV' || item.concept === 'DVS') {
          totalEVentas += (item.energyVentas || 0);
          totalCDerechos += (item.costDerechos || 0);
          totalECompras += (item.energyCompras || 0);
          totalCOblig += (item.costObligaciones || 0);
        }
      }
    }
  }

  console.log('Total eVentas:', totalEVentas);
  console.log('Total cDerechos:', totalCDerechos);
  console.log('Total eCompras:', totalECompras);
  console.log('Total cOblig:', totalCOblig);
  console.log('defaultPriceSubir:', totalECompras > 0 ? totalCOblig / totalECompras : 0);
  console.log('defaultPriceBajar:', totalEVentas > 0 ? totalCDerechos / totalEVentas : 0);
}

main().catch(console.error).finally(() => prisma.$disconnect());
