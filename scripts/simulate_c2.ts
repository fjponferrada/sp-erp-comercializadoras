import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { getPeriodoREE } from '../src/lib/services/InternalBillingEngine';

async function run() {
  const targetMonth = '2026-03';
  const targetCierre = 'C2';
  const startRange = parseISO('2026-03-01T00:00:00Z');
  const endRange = endOfMonth(startRange);

  console.log(`Simulando mes ${targetMonth} usando cierre ${targetCierre}...`);

  const companiesToProcess = await prisma.company.findMany();

  for (const company of companiesToProcess) {
    console.log(`\n=== PROCESANDO COMPAÑÍA: ${company.name} ===`);

    // Fetch the base closure record for C2
    const reganecuRecord = await prisma.reganecuData.findFirst({
      where: {
        date: { gte: startRange, lte: endRange },
        total: true,
        matricial: false,
        companyId: company.id,
        cierre: targetCierre
      }
    });

    if (!reganecuRecord) {
      console.log(`No se encontró el cierre ${targetCierre} para ${targetMonth}`);
      continue;
    }

    // Fetch aggregated curves
    const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
      where: {
        date: { gte: startRange, lte: endRange },
        companyId: company.id
      }
    });

    const dailyConsumptionBySegment = new Map<string, Record<string, number[]>>();
    for (const curve of aggregatedCurves) {
      const dayKey = format(curve.date, 'yyyy-MM-dd');
      if (!dailyConsumptionBySegment.has(dayKey)) dailyConsumptionBySegment.set(dayKey, {});
      const dayMap = dailyConsumptionBySegment.get(dayKey)!;
      const segmentKey = `${curve.segment}|${curve.tariff || '2.0TD'}`;
      if (!dayMap[segmentKey]) dayMap[segmentKey] = Array(24).fill(0);
      
      for (let h = 0; h < 24; h++) {
        if (curve.totalConsumption[h]) dayMap[segmentKey][h] += curve.totalConsumption[h];
      }
    }

    // Prices
    const prices = await prisma.systemComponentPrice.findMany({
      where: {
        date: { gte: startRange, lte: endRange },
        component: { in: ['OS', 'RESTRICCIONES', 'K', 'PERD_20TD', 'PERD_30TD', 'PERD_61TD'] }
      }
    });
    const pricesByDateComponent = new Map<string, number[]>();
    for (const price of prices) {
      const dayKey = format(price.date, 'yyyy-MM-dd');
      pricesByDateComponent.set(`${dayKey}_${price.component}`, price.values);
    }

    const perdidasBOE = await prisma.regulatedCost.findMany({ where: { concept: 'PERDIDAS' } });
    const boeByTariff = new Map<string, any>();
    for (const b of perdidasBOE) boeByTariff.set(b.tariff, b);

    // Fetch matricial ReganecuData for this month and C2
    const reganecuMatricialRecords = await prisma.reganecuData.findMany({
      where: {
        date: { gte: startRange, lte: endRange },
        cierre: targetCierre,
        matricial: true,
        resolution: { in: ['H', 'QH'] },
        companyId: company.id
      },
    });

    const dsvPriceSubirByDayPeriod = new Map<string, number>();
    const dsvPriceBajarByDayPeriod = new Map<string, number>();
    const cadEnergyByDayPeriod = new Map<string, number>();

    let totalECompras = 0, totalCOblig = 0, totalEVentas = 0, totalCDerechos = 0;

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

    const defaultPriceSubir = totalECompras > 0 ? totalCOblig / totalECompras : 0;
    const defaultPriceBajar = totalEVentas > 0 ? totalCDerechos / totalEVentas : 0;
    
    for (const matRecord of reganecuMatricialRecords) {
      const dayKey = format(matRecord.date, 'yyyy-MM-dd');
      const jData = matRecord.jsonData as any[];
      if (!Array.isArray(jData)) continue;

      if (matRecord.resolution === 'H' || matRecord.resolution === 'QH') {
        const isQh = matRecord.resolution === 'QH';
        const aggDsv: Record<number, { eV: number, cD: number, eC: number, cO: number }> = {};
        const aggCad: Record<number, number> = {};
        
        for (const item of jData) {
          const period = isQh ? Math.floor((item.period - 1) / 4) + 1 : item.period;

          if (item.concept === 'DSV' || item.concept === 'DVS') {
            if (!aggDsv[period]) aggDsv[period] = { eV: 0, cD: 0, eC: 0, cO: 0 };
            aggDsv[period].eV += (item.energyVentas || 0);
            aggDsv[period].cD += (item.costDerechos || 0);
            aggDsv[period].eC += (item.energyCompras || 0);
            aggDsv[period].cO += (item.costObligaciones || 0);
          } else if (item.concept === 'CAD') {
            if (!aggCad[period]) aggCad[period] = 0;
            aggCad[period] += (item.energyVentas || 0) + (item.energyCompras || 0);
          }
        }
        
        for (const p of Object.keys(aggDsv)) {
          const period = parseInt(p);
          const data = aggDsv[period];
          dsvPriceSubirByDayPeriod.set(`${dayKey}_${period}`, data.eC > 0 ? data.cO / data.eC : defaultPriceSubir);
          dsvPriceBajarByDayPeriod.set(`${dayKey}_${period}`, data.eV > 0 ? data.cD / data.eV : defaultPriceBajar);
        }
        
        for (const p of Object.keys(aggCad)) {
          cadEnergyByDayPeriod.set(`${dayKey}_${p}`, aggCad[parseInt(p)]);
        }
      }
    }

    let totalEstimatedBcMwh = 0, totalLiquidatedMwh = 0, totalPendingMwh = 0, totalEstimatedPendingCostEur = 0;

    for (let d = startRange.getDate(); d <= endRange.getDate(); d++) {
      const dateObj = new Date(startRange);
      dateObj.setDate(d);
      const dayKey = format(dateObj, 'yyyy-MM-dd');
      const consumption = dailyConsumptionBySegment.get(dayKey);
      if (!consumption) continue;

      const os = pricesByDateComponent.get(`${dayKey}_OS`) || Array(24).fill(0);
      const restricciones = pricesByDateComponent.get(`${dayKey}_RESTRICCIONES`) || Array(24).fill(0);
      const perd20 = pricesByDateComponent.get(`${dayKey}_PERD_20TD`);
      const perd30 = pricesByDateComponent.get(`${dayKey}_PERD_30TD`);
      const perd61 = pricesByDateComponent.get(`${dayKey}_PERD_61TD`);
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

      for (let h = 0; h < 24; h++) {
        let hBcMwh = 0;
        const p20 = getLossForHour('2.0TD', h, perd20);
        const p30 = getLossForHour('3.0TD', h, perd30);
        const p61 = getLossForHour('6.1TD', h, perd61);

        for (const segKey of Object.keys(consumption)) {
          if (consumption[segKey][h]) {
            const underlyingTariff = segKey.split('|')[1];
            let lossP = underlyingTariff === '2.0TD' ? p20 : underlyingTariff === '3.0TD' ? p30 : underlyingTariff === '6.1TD' ? p61 : p20;
            hBcMwh += (consumption[segKey][h] / 1000) * (1 + (Math.abs(lossP) > 1.0 ? lossP/100 : lossP));
          }
        }

        const period = h + 1;
        const hLiquidatedMwh = cadEnergyByDayPeriod.get(`${dayKey}_${period}`) || 0;
        const hDsvPriceSubir = dsvPriceSubirByDayPeriod.get(`${dayKey}_${period}`) || dsvPriceSubirByDayPeriod.get(`${dayKey}_0`) || defaultPriceSubir;
        const hDsvPriceBajar = dsvPriceBajarByDayPeriod.get(`${dayKey}_${period}`) || dsvPriceBajarByDayPeriod.get(`${dayKey}_0`) || defaultPriceBajar;
        
        const hPendingMwh = hBcMwh - hLiquidatedMwh;
        const hDsvPrice = hPendingMwh > 0 ? hDsvPriceSubir : hDsvPriceBajar;
        const hPrice = hDsvPrice + (os[h] || 0) + (restricciones[h] || 0);

        totalEstimatedBcMwh += hBcMwh;
        totalLiquidatedMwh += hLiquidatedMwh;
        totalPendingMwh += hPendingMwh;
        totalEstimatedPendingCostEur += hPendingMwh * hPrice;
      }
    }

    console.log(`\nRESULTADOS SIMULACIÓN MARZO 2026 (C2):`);
    console.log(`- Demanda BC Estimada: ${totalEstimatedBcMwh.toFixed(2)} MWh`);
    console.log(`- Liquidado REE (C2): ${totalLiquidatedMwh.toFixed(2)} MWh`);
    console.log(`- Energía Pendiente: ${totalPendingMwh.toFixed(2)} MWh`);
    console.log(`- Valoración Pendiente: ${totalEstimatedPendingCostEur.toFixed(2)} €\n`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
