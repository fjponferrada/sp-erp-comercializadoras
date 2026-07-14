import { prisma } from './src/lib/prisma';
import { format } from 'date-fns';

async function main() {
  const matRecords = await prisma.reganecuData.findMany({
    where: {
      date: { gte: new Date('2026-03-01'), lte: new Date('2026-03-05') },
      cierre: 'C2',
      matricial: true,
      resolution: { in: ['H', 'QH'] }
    }
  });

  for (const matRecord of matRecords) {
    const dayKey = format(matRecord.date, 'yyyy-MM-dd');
    const jData = matRecord.jsonData as any[];
    if (!Array.isArray(jData)) continue;

    const aggDsv: Record<number, { eV: number, cD: number, eC: number, cO: number }> = {};
    for (const item of jData) {
      const period = item.period;
      if (item.concept === 'DSV' || item.concept === 'DVS') {
        if (!aggDsv[period]) aggDsv[period] = { eV: 0, cD: 0, eC: 0, cO: 0 };
        aggDsv[period].eV += (item.energyVentas || 0);
        aggDsv[period].cD += (item.costDerechos || 0);
        aggDsv[period].eC += (item.energyCompras || 0);
        aggDsv[period].cO += (item.costObligaciones || 0);
      }
    }
    
    for (const p of Object.keys(aggDsv)) {
      const period = parseInt(p);
      const data = aggDsv[period];
      let pSubir = data.eC > 0 ? data.cO / data.eC : 0;
      if (pSubir > 500) {
        console.log(`High price Subir in ${dayKey} period ${period}: ${pSubir} (cO: ${data.cO}, eC: ${data.eC})`);
      }
    }
  }
}
main().finally(() => prisma.$disconnect());
