import { prisma } from './src/lib/prisma';
import { format } from 'date-fns';

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
  for (const matRecord of reganecuMatricialRecords) {
    const dayKey = format(matRecord.date, 'yyyy-MM-dd');
    const jData = matRecord.jsonData as any[];
    if (!Array.isArray(jData)) continue;

    const aggCad: Record<number, number> = {};
    for (const item of jData) {
      if (item.concept === 'CAD') {
        const period = item.period;
        if (!aggCad[period]) aggCad[period] = 0;
        aggCad[period] += (item.energyVentas || 0) + (item.energyCompras || 0);
      }
    }
    for (const p of Object.keys(aggCad)) {
      cadEnergyByDayPeriod.set(`${dayKey}_${p}`, aggCad[parseInt(p)]);
    }
  }

  // print out the first 5 days
  let totalGrossShort = 0;
  let totalGrossLong = 0;
  let netPending = 0;

  for (let d = 1; d <= 31; d++) {
    const dayStr = `2026-03-${d.toString().padStart(2, '0')}`;
    for (let p = 1; p <= 24; p++) {
      const hLiq = cadEnergyByDayPeriod.get(`${dayStr}_${p}`) || 0;
      // hBc is unknown here, but wait, hLiq is all we have.
      // Wait, we need hBc to see hPending!
    }
  }
}
main().finally(() => prisma.$disconnect());
