import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';
import { getPeriodoREE } from '../lib/services/InternalBillingEngine';

export async function runCalculatePendingEnergy(onProgress?: (msg: string) => void, targetCompanyId?: string) {
  console.log(`Iniciando cálculo de energía pendiente. Compañía objetivo: ${targetCompanyId || 'TODAS'}`);
  if (onProgress) onProgress('Iniciando cálculo de energía pendiente...');
  
  const today = new Date();
  const endRange = endOfMonth(today);
  const startRange = startOfMonth(subMonths(today, 11));

  let companiesToProcess = [];
  if (targetCompanyId) {
    const comp = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (comp) companiesToProcess.push(comp);
  } else {
    companiesToProcess = await prisma.company.findMany();
  }

  for (const company of companiesToProcess) {
    if (onProgress) onProgress(`Procesando compañía: ${company.name}`);
    console.log(`=== PROCESANDO COMPAÑÍA: ${company.name} ===`);

    // 1. Fetch ReganecuData for CAD, total: true, matricial: false to find the latest closure
    const reganecuRecords = await prisma.reganecuData.findMany({
      where: {
        date: { gte: startRange, lte: endRange },
        total: true,
        matricial: false,
        companyId: company.id
      }
    });

    const cierreOrder = ['A1', 'C1', 'A2', 'C2', 'A3', 'C3', 'A4', 'C4', 'A5', 'C5'];
    const getCierreRank = (cierre: string) => {
      const idx = cierreOrder.indexOf(cierre.toUpperCase());
      return idx === -1 ? -1 : idx;
    };

    const reganecuByMonth = new Map<string, any>();
    for (const record of reganecuRecords) {
      const monthKey = format(record.date, 'yyyy-MM');
      const existing = reganecuByMonth.get(monthKey);
      
      if (!existing || getCierreRank(record.cierre) > getCierreRank(existing.cierre)) {
        reganecuByMonth.set(monthKey, record);
      }
    }

  // 2. Fetch AggregatedLoadCurve for the period
  const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
    where: {
      date: { gte: startRange, lte: endRange },
      companyId: company.id
    }
  });

  const dailyConsumptionBySegment = new Map<string, Record<string, number[]>>();
  for (const curve of aggregatedCurves) {
    const dayKey = format(curve.date, 'yyyy-MM-dd');
    if (!dailyConsumptionBySegment.has(dayKey)) {
      dailyConsumptionBySegment.set(dayKey, {});
    }
    const dayMap = dailyConsumptionBySegment.get(dayKey)!;
    
    // Agrupar por segmento y tarifa para no perder precisión
    const segmentKey = `${curve.segment}|${curve.tariff || '2.0TD'}`;
    if (!dayMap[segmentKey]) {
      dayMap[segmentKey] = Array(24).fill(0);
    }
    
    for (let h = 0; h < 24; h++) {
      if (curve.totalConsumption[h]) {
        dayMap[segmentKey][h] += curve.totalConsumption[h];
      }
    }
  }

  // 3. Fetch SystemComponentPrice for Losses, OS, RESTRICCIONES
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

  // Fetch BOE Perdidas from RegulatedCost
  const perdidasBOE = await prisma.regulatedCost.findMany({
    where: { concept: 'PERDIDAS' }
  });
  const boeByTariff = new Map<string, any>();
  for (const b of perdidasBOE) {
    boeByTariff.set(b.tariff, b);
  }

  // 4. Calculate for each month
  for (let i = 11; i >= 0; i--) {
    const currentMonthStart = startOfMonth(subMonths(today, i));
    const currentMonthEnd = endOfMonth(currentMonthStart);
    const monthKey = format(currentMonthStart, 'yyyy-MM');

    // Get the base closure for the month
    const regRecord = reganecuByMonth.get(monthKey);
    let cierreBase = 'N/A';
    if (regRecord && regRecord.jsonData) {
      cierreBase = regRecord.cierre;
    }

    // Fetch invoices to calculate prorated energy
    const invoices = await prisma.invoice.findMany({
      where: {
        billingStart: { lte: currentMonthEnd },
        billingEnd: { gte: currentMonthStart },
        client: { brand: { companyId: company.id } }
      },
      select: {
        invoiceType: true,
        billingStart: true,
        billingEnd: true,
        totalMWh: true,
      }
    });

    let totalInvoicedMwh = 0;
    for (const inv of invoices) {
      if (!inv.billingStart || !inv.billingEnd) continue;

      const start = inv.billingStart < currentMonthStart ? currentMonthStart : inv.billingStart;
      const end = inv.billingEnd > currentMonthEnd ? currentMonthEnd : inv.billingEnd;

      const overlapDays = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
      const totalDays = Math.round((inv.billingEnd.getTime() - inv.billingStart.getTime()) / (1000 * 3600 * 24)) + 1;

      if (overlapDays > 0 && totalDays > 0) {
        let rawMWh = inv.totalMWh / 1000;
        if (inv.invoiceType?.toLowerCase().includes('abono')) {
          rawMWh = -Math.abs(rawMWh);
        } else {
          rawMWh = Math.abs(rawMWh);
        }
        totalInvoicedMwh += (rawMWh / totalDays) * overlapDays;
      }
    }

    // Fetch matricial ReganecuData for this month and this closure to extract DSV prices and CAD energy
    const reganecuMatricialRecords = await prisma.reganecuData.findMany({
      where: {
        date: { gte: currentMonthStart, lte: currentMonthEnd },
        cierre: cierreBase,
        matricial: true,
        resolution: { in: ['H', 'QH'] },
        companyId: company.id
      },
    });

    const dsvPriceSubirByDayPeriod = new Map<string, number>();
    const dsvPriceBajarByDayPeriod = new Map<string, number>();
    const cadEnergyByDayPeriod = new Map<string, number>();

    let totalECompras = 0;
    let totalCOblig = 0;
    let totalEVentas = 0;
    let totalCDerechos = 0;

    // Primer pase para sacar medias globales del mes
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
          
          let pSubir = data.eC > 0 ? data.cO / data.eC : defaultPriceSubir;
          let pBajar = data.eV > 0 ? data.cD / data.eV : defaultPriceBajar;

          dsvPriceSubirByDayPeriod.set(`${dayKey}_${period}`, pSubir);
          dsvPriceBajarByDayPeriod.set(`${dayKey}_${period}`, pBajar);
        }
        
        for (const p of Object.keys(aggCad)) {
          cadEnergyByDayPeriod.set(`${dayKey}_${p}`, aggCad[parseInt(p)]);
        }
      }
    }

    let totalEstimatedBcMwh = 0;
    let totalLiquidatedMwh = 0;
    let totalPendingMwh = 0;
    let totalEstimatedPendingCostEur = 0;

    for (let d = currentMonthStart.getDate(); d <= currentMonthEnd.getDate(); d++) {
      const dateObj = new Date(currentMonthStart);
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
      
      // Helper function to get exact loss percentage for an hour
      const getLossForHour = (tariff: string, h: number, oldPerdArray: number[] | undefined) => {
        // Fallback to exactly calculated old PERD if BOE or K is missing
        const boe = boeByTariff.get(tariff);
        if (!boe) return oldPerdArray ? oldPerdArray[h] : 0;
        
        const dateObjH = new Date(dateObj);
        dateObjH.setUTCHours(h);
        const periodStr = getPeriodoREE(dateObjH, tariff); // P1, P2...
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
            let lossP = 0;
            if (underlyingTariff === '2.0TD') lossP = p20;
            else if (underlyingTariff === '3.0TD') lossP = p30;
            else if (underlyingTariff === '6.1TD') lossP = p61;
            else lossP = p20;
            
            hBcMwh += (consumption[segKey][h] / 1000) * (1 + (Math.abs(lossP) > 1.0 ? lossP/100 : lossP));
          }
        }

        const period = h + 1; // reganecu periods are 1-indexed (1-24)
        
        const hLiquidatedMwh = cadEnergyByDayPeriod.get(`${dayKey}_${period}`) || 0;
        
        const hDsvPriceSubir = dsvPriceSubirByDayPeriod.get(`${dayKey}_${period}`) || dsvPriceSubirByDayPeriod.get(`${dayKey}_0`) || defaultPriceSubir;
        const hDsvPriceBajar = dsvPriceBajarByDayPeriod.get(`${dayKey}_${period}`) || dsvPriceBajarByDayPeriod.get(`${dayKey}_0`) || defaultPriceBajar;
        
        const hPendingMwh = hBcMwh - hLiquidatedMwh;
        
        let hDsvPrice = 0;
        if (hPendingMwh > 0) {
          // Si consumimos de más, pagamos el desvío a subir
          hDsvPrice = hDsvPriceSubir;
        } else {
          // Si consumimos de menos, cobramos el desvío a bajar
          hDsvPrice = hDsvPriceBajar;
        }

        // Cost incorporates OS and RESTRICCIONES along with DSV price
        const hPrice = hDsvPrice + (os[h] || 0) + (restricciones[h] || 0);
        const hPendingCostEur = hPendingMwh * hPrice;

        totalEstimatedBcMwh += hBcMwh;
        totalLiquidatedMwh += hLiquidatedMwh;
        totalPendingMwh += hPendingMwh;
        totalEstimatedPendingCostEur += hPendingCostEur;
      }
    }

    await prisma.pendingEnergySummary.upsert({
      where: { 
        month_companyId: {
          month: monthKey,
          companyId: company.id
        }
      },
      update: {
        cierre: cierreBase,
        estimatedBcMwh: totalEstimatedBcMwh,
        liquidatedMwh: totalLiquidatedMwh,
        pendingMwh: totalPendingMwh,
        estimatedPendingCostEur: totalEstimatedPendingCostEur,
        invoicedMwh: totalInvoicedMwh
      },
      create: {
        month: monthKey,
        companyId: company.id,
        cierre: cierreBase,
        estimatedBcMwh: totalEstimatedBcMwh,
        liquidatedMwh: totalLiquidatedMwh,
        pendingMwh: totalPendingMwh,
        estimatedPendingCostEur: totalEstimatedPendingCostEur,
        invoicedMwh: totalInvoicedMwh
      }
    });

    const msg = `✅ Mes ${monthKey} procesado. Cierre: ${cierreBase}. Pendiente MWh: ${totalPendingMwh.toFixed(2)}`;
    console.log(msg);
    if (onProgress) onProgress(msg);
  } // Fin loop de meses
  } // Fin loop de compañías

  console.log('Cálculo finalizado exitosamente.');
  if (onProgress) onProgress('Cálculo finalizado exitosamente.');
}


if (require.main === module) {
  runCalculatePendingEnergy()
    .catch((e) => {
      console.error('Error calculando:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

