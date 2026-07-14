import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';
import { getPeriodoREE } from './src/lib/services/InternalBillingEngine';

async function main() {
  const today = new Date();
  const endRange = endOfMonth(today);
  const startRange = startOfMonth(subMonths(today, 11));

  const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
    where: {
      date: { gte: startRange, lte: endRange }
    }
  });

  const dailyConsumptionBySegment = new Map<string, Record<string, number[]>>();
  for (const curve of aggregatedCurves) {
    const dayKey = format(curve.date, 'yyyy-MM-dd');
    if (!dailyConsumptionBySegment.has(dayKey)) dailyConsumptionBySegment.set(dayKey, {});
    const dayMap = dailyConsumptionBySegment.get(dayKey)!;
    const segment = curve.segment;
    if (!dayMap[segment]) dayMap[segment] = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      if (curve.totalConsumption[h]) dayMap[segment][h] += curve.totalConsumption[h];
    }
  }

  const prices = await prisma.systemComponentPrice.findMany({
    where: {
      date: { gte: startRange, lte: endRange },
      component: { in: ['K', 'PERD_20TD'] }
    }
  });

  const pricesByDateComponent = new Map<string, number[]>();
  for (const price of prices) {
    const dayKey = format(price.date, 'yyyy-MM-dd');
    pricesByDateComponent.set(`${dayKey}_${price.component}`, price.values);
  }

  const perdidasBOE = await prisma.regulatedCost.findMany({
    where: { concept: 'PERDIDAS' }
  });
  const boeByTariff = new Map<string, any>();
  for (const b of perdidasBOE) {
    boeByTariff.set(b.tariff, b);
  }

  const currentMonthStart = new Date('2026-03-01T00:00:00.000');
  const currentMonthEnd = endOfMonth(currentMonthStart);
  
  let totalEstimatedBcMwh = 0;

  for (let d = currentMonthStart.getDate(); d <= currentMonthEnd.getDate(); d++) {
    const dateObj = new Date(currentMonthStart);
    dateObj.setDate(d);
    const dayKey = format(dateObj, 'yyyy-MM-dd');

    const consumption = dailyConsumptionBySegment.get(dayKey);
    if (!consumption) continue;

    const perd20 = pricesByDateComponent.get(`${dayKey}_PERD_20TD`);
    const kFactor = pricesByDateComponent.get(`${dayKey}_K`) || Array(24).fill(1);

    const getLossForHour = (tariff: string, h: number, oldPerdArray: number[] | undefined) => {
      const boe = boeByTariff.get(tariff);
      if (!boe) return oldPerdArray ? oldPerdArray[h] : 0;
      const dateObjH = new Date(dateObj);
      dateObjH.setUTCHours(h);
      const periodStr = getPeriodoREE(dateObjH, tariff);
      const pVal = boe[periodStr.toLowerCase() as keyof typeof boe] as number | null;
      if (pVal === null || pVal === undefined) return oldPerdArray ? oldPerdArray[h] : 0;
      return pVal * kFactor[h];
    };

    const getTariffForSegment = (seg: string) => {
      if (seg.includes('HOGAR') || seg === 'VIP' || seg === 'VE <15 MWh') return '2.0TD';
      if (seg === 'PYME <50 MWh' || seg === 'VE >15 MWh' || seg.includes('3.0')) return '3.0TD';
      if (seg === 'PYME >50 MWh' || seg.includes('6.1')) return '6.1TD';
      return '2.0TD';
    };

    let dayBcMwh = 0;
    for (let h = 0; h < 24; h++) {
      let hBcMwh = 0;
      const p20 = getLossForHour('2.0TD', h, perd20);
      const p30 = getLossForHour('3.0TD', h, undefined);
      const p61 = getLossForHour('6.1TD', h, undefined);

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
      dayBcMwh += hBcMwh;
    }
    console.log(dayKey, dayBcMwh);
    totalEstimatedBcMwh += dayBcMwh;
  }

  console.log('Total Estimated BC MWh calculated EXACTLY as script:', totalEstimatedBcMwh);
}
main().finally(() => prisma.$disconnect());
