import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';

export async function GET() {
  const currentMonthStart = new Date('2026-07-01T00:00:00Z');
  const currentMonthEnd = new Date('2026-07-31T23:59:59Z');

  const reganecuMatricialRecords = await prisma.reganecuData.findMany({
    where: {
      date: { gte: new Date('2026-04-01'), lte: new Date('2026-04-30') },
      cierre: 'C3',
      matricial: true,
      resolution: { in: ['H', 'QH'] }
    },
  });

  const hourly: any[] = [];
  let violations = 0;
  let validHours = 0;

  for (const matRecord of reganecuMatricialRecords) {
    const dayKey = format(matRecord.date, 'yyyy-MM-dd');
    const jData = matRecord.jsonData as any[];
    if (!Array.isArray(jData)) continue;

    const isQh = matRecord.resolution === 'QH';
    const aggDsv: Record<number, { eV: number, cD: number, eC: number, cO: number }> = {};
    
    for (const item of jData) {
      const period = isQh ? Math.floor((item.period - 1) / 4) + 1 : item.period;

      if (item.concept === 'DSV' || item.concept === 'DVS') {
        if (!aggDsv[period]) aggDsv[period] = { eV: 0, cD: 0, eC: 0, cO: 0 };
        aggDsv[period].eV += (item.energyVentas || 0);
        aggDsv[period].cD += (item.costDerechos || 0);
        aggDsv[period].eC += (item.energyCompras || 0);
        aggDsv[period].cO += (item.costObligaciones || 0);
      }
    }
    
    for (const p of Object.keys(aggDsv)) {
      const data = aggDsv[parseInt(p)];
      // Only compare when volume is significant to avoid rounding errors
      if (data.eC > 0.1 && data.eV > 0.1) {
        const pSubir = data.cO / data.eC;
        const pBajar = data.cD / data.eV;
        validHours++;
        if (pBajar > pSubir + 0.01) { // 1 cent threshold for floating point
          violations++;
          if (hourly.length < 20) {
            hourly.push({ dayKey, period: p, pSubir, pBajar, eV: data.eV, eC: data.eC });
          }
        }
      }
    }
  }

  return NextResponse.json({ validHours, violations, sampleViolations: hourly });
}
