import { prisma } from './src/lib/prisma';
import { format } from 'date-fns';

async function main() {
  const matRecords = await prisma.reganecuData.findMany({
    where: {
      date: { gte: new Date('2026-03-01'), lte: new Date('2026-03-31') },
      cierre: 'C2',
      matricial: true,
      resolution: { in: ['H', 'QH'] }
    }
  });

  let totalE = 0;
  let totalC = 0;

  for (const matRecord of matRecords) {
    const jData = matRecord.jsonData as any[];
    if (!Array.isArray(jData)) continue;

    for (const item of jData) {
      if (item.concept === 'DSV' || item.concept === 'DVS') {
        totalE += (item.energyVentas || 0) + (item.energyCompras || 0);
        totalC += (item.costDerechos || 0) + (item.costObligaciones || 0);
      }
    }
  }
  
  console.log('Total Energy (MWh):', totalE);
  console.log('Total Cost (Eur):', totalC);
  console.log('Average DSV Price (Eur/MWh):', totalE > 0 ? totalC / totalE : 0);
}
main().finally(() => prisma.$disconnect());
