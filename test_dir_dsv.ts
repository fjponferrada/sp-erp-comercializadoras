import { prisma } from './src/lib/prisma';

async function main() {
  const matRecords = await prisma.reganecuData.findMany({
    where: {
      date: { gte: new Date('2026-03-01'), lte: new Date('2026-03-31') },
      cierre: 'C2',
      matricial: true,
      resolution: { in: ['H', 'QH'] }
    }
  });

  let eVentas = 0;
  let cDerechos = 0;
  let eCompras = 0;
  let cOblig = 0;

  for (const matRecord of matRecords) {
    const jData = matRecord.jsonData as any[];
    if (!Array.isArray(jData)) continue;

    for (const item of jData) {
      if (item.concept === 'DSV' || item.concept === 'DVS') {
        eVentas += (item.energyVentas || 0);
        cDerechos += (item.costDerechos || 0);
        eCompras += (item.energyCompras || 0);
        cOblig += (item.costObligaciones || 0);
      }
    }
  }
  
  console.log(`Ventas (Desvío a bajar): ${eVentas} MWh, Derechos: ${cDerechos} Eur -> Avg: ${eVentas > 0 ? cDerechos / eVentas : 0} Eur/MWh`);
  console.log(`Compras (Desvío a subir): ${eCompras} MWh, Obligaciones: ${cOblig} Eur -> Avg: ${eCompras > 0 ? cOblig / eCompras : 0} Eur/MWh`);
}
main().finally(() => prisma.$disconnect());
