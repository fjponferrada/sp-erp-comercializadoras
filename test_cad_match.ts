import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { format, startOfMonth, subMonths, endOfMonth } from 'date-fns';

async function main() {
  const currentMonthStart = new Date('2026-03-01T00:00:00Z');
  const currentMonthEnd = new Date('2026-03-31T23:59:59Z');
  
  const reganecuMatricialRecords = await prisma.reganecuData.findMany({
    where: {
      date: { gte: currentMonthStart, lte: currentMonthEnd },
      cierre: 'C2',
      matricial: true,
      resolution: { in: ['H', 'QH'] }
    }
  });

  const cadEnergyByDayPeriod = new Map<string, number>();
  let sumCadMatricial = 0;
  let maxPer = 0;
  
  for (const matRecord of reganecuMatricialRecords) {
    const dayKey = format(matRecord.date, 'yyyy-MM-dd');
    const jData = matRecord.jsonData as any[];
    if (!Array.isArray(jData)) continue;

    const aggCad: Record<number, number> = {};
    for (const item of jData) {
      if (item.concept === 'CAD') {
        const period = item.period;
        if (period > maxPer) maxPer = period;
        if (!aggCad[period]) aggCad[period] = 0;
        aggCad[period] += (item.energyVentas || 0) + (item.energyCompras || 0);
      }
    }
    for (const p of Object.keys(aggCad)) {
      sumCadMatricial += aggCad[parseInt(p)];
    }
  }

  console.log(`Sum CAD from Matricial: ${sumCadMatricial}`);

  const regTotal = await prisma.reganecuData.findFirst({
    where: {
      date: { gte: currentMonthStart, lte: currentMonthEnd },
      cierre: 'C2',
      matricial: false,
      total: true
    }
  });

  let sumCadTotal = 0;
  if (regTotal && regTotal.jsonData) {
    const j = regTotal.jsonData as any;
    if (j.CAD) {
      sumCadTotal = (j.CAD.energyCompras || 0) + (j.CAD.energyVentas || 0);
    }
  }
  
  console.log(`Sum CAD from TOTAL file: ${sumCadTotal}`);
}
main().finally(() => prisma.$disconnect());
