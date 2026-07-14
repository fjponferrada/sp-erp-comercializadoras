import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';
import { getPeriodoREE } from './src/lib/services/InternalBillingEngine';

async function check() {
  const currentMonthStart = new Date('2026-03-01T00:00:00.000');
  const currentMonthEnd = endOfMonth(currentMonthStart);
  
  const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
    where: {
      date: { gte: currentMonthStart, lte: currentMonthEnd }
    }
  });

  const dailyConsumptionBySegment = new Map<string, Record<string, number[]>>();
  for (const curve of aggregatedCurves) {
    const dayKey = format(curve.date, 'yyyy-MM-dd');
    if (!dailyConsumptionBySegment.has(dayKey)) {
      dailyConsumptionBySegment.set(dayKey, {});
    }
    const dayMap = dailyConsumptionBySegment.get(dayKey)!;
    
    const segment = curve.segment;
    if (!dayMap[segment]) {
      dayMap[segment] = Array(24).fill(0);
    }
    
    for (let h = 0; h < 24; h++) {
      if (curve.totalConsumption[h]) {
        dayMap[segment][h] += curve.totalConsumption[h];
      }
    }
  }

  const perdidasBOE = await prisma.regulatedCost.findMany({
    where: { concept: 'PERDIDAS' }
  });
  const boeByTariff = new Map<string, any>();
  for (const b of perdidasBOE) {
    boeByTariff.set(b.tariff, b);
  }

  let totalBc = 0;

  for (let d = currentMonthStart.getDate(); d <= currentMonthEnd.getDate(); d++) {
    const dateObj = new Date(currentMonthStart);
    dateObj.setDate(d);
    const dayKey = format(dateObj, 'yyyy-MM-dd');

    const consumption = dailyConsumptionBySegment.get(dayKey);
    if (!consumption) continue;

    const kFactor = Array(24).fill(1.19); // Simplified

    const getLossForHour = (tariff: string, h: number) => {
      const boe = boeByTariff.get(tariff);
      if (!boe) return 0;
      const dateObjH = new Date(dateObj);
      dateObjH.setUTCHours(h);
      const periodStr = getPeriodoREE(dateObjH, tariff);
      const pVal = boe[periodStr.toLowerCase() as keyof typeof boe];
      if (pVal == null) return 0;
      return pVal * kFactor[h];
    };

    const getTariffForSegment = (seg: string) => {
      if (seg.includes('HOGAR') || seg === 'VIP' || seg === 'VE <15 MWh') return '2.0TD';
      if (seg === 'PYME <50 MWh' || seg === 'VE >15 MWh' || seg.includes('3.0')) return '3.0TD';
      if (seg === 'PYME >50 MWh' || seg.includes('6.1')) return '6.1TD';
      return '2.0TD';
    };

    for (let h = 0; h < 24; h++) {
      let hBcMwh = 0;
      const p20 = getLossForHour('2.0TD', h);
      const p30 = getLossForHour('3.0TD', h);
      const p61 = getLossForHour('6.1TD', h);

      for (const seg of Object.keys(consumption)) {
        if (consumption[seg][h]) {
          const underlyingTariff = getTariffForSegment(seg);
          let lossP = 0;
          if (underlyingTariff === '2.0TD') lossP = p20;
          else if (underlyingTariff === '3.0TD') lossP = p30;
          else if (underlyingTariff === '6.1TD') lossP = p61;
          else lossP = p20;
          
          hBcMwh += (consumption[seg][h] / 1000) * (1 + (lossP > 2.0 ? lossP/100 : lossP));
        }
      }
      totalBc += hBcMwh;
    }
  }

  console.log('Total BC:', totalBc);
}

check().finally(() => prisma.$disconnect());
