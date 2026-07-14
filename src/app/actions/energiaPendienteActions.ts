'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { endOfMonth, startOfMonth, subMonths, isBefore, isAfter, min, max, differenceInDays } from 'date-fns';
import { PricingEngine } from '@/lib/services/PricingEngine';

export interface PendingEnergyData {
  contractId: string;
  contractCode: string;
  cups: string;
  status: string;
  lastBilledDate: string | null;
  annualConsumption: number;
  totalPendingDays: number;
  totalPendingMWh: number;
  m0PendingMWh: number;
  m1PendingMWh: number;
  m2PendingMWh: number;
  m0Euros: number;
  m1Euros: number;
  m2Euros: number;
  estimatedEurosRaw: number;
  estimatedEurosWithTaxes: number;
}

export async function getPendingEnergyAction(): Promise<{ success: true; data: PendingEnergyData[] } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    const cookieStore = await cookies();
    const activeCompanyId = cookieStore.get('active-company')?.value || (session.user as any).companyId;

    if (!activeCompanyId) throw new Error('No active company selected');

    // Fetch contracts with their latest invoice date
    const contractsRaw = await prisma.$queryRaw`
      SELECT 
        c.id as "contractId",
        c."contractCode",
        c."status",
        c."activationDate",
        c."terminationDate",
        c."airtableData",
        c."pricingModel",
        c."fee",
        c."p1e", c."p2e", c."p3e", c."p4e", c."p5e", c."p6e",
        c."p1p", c."p2p", c."p3p", c."p4p", c."p5p", c."p6p",
        sp."tariff",
        sp."p1c", sp."p2c", sp."p3c", sp."p4c", sp."p5c", sp."p6c",
        sp."annualConsumption",
        sp."cups",
        i_max."lastBilledDate"
      FROM "Contract" c
      JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
      JOIN "Brand" b ON c."brandId" = b.id
      LEFT JOIN (
        SELECT sp2."cups", MAX(i2."billingEnd") as "lastBilledDate"
        FROM "Invoice" i2
        JOIN "Contract" c2 ON i2."contractId" = c2.id
        JOIN "SupplyPoint" sp2 ON c2."supplyPointId" = sp2.id
        GROUP BY sp2."cups"
      ) i_max ON i_max."cups" = sp."cups"
      WHERE c.status IN ('ACTIVO', 'FINALIZADO', 'Finalizado', 'Activo')
      AND c."activationDate" IS NOT NULL
      AND b."companyId" = ${activeCompanyId}
    `;

    const today = new Date();

    const historyM12 = await prisma.$queryRaw`
      SELECT 
        sp."cups",
        EXTRACT(MONTH FROM i."billingEnd") as "month",
        SUM(
          CASE 
            WHEN i."invoiceType" ILIKE '%abono%' THEN -1 * ABS(i."totalMWh")
            ELSE ABS(i."totalMWh") 
          END
        ) / 1000 as "totalMWh",
        SUM(
          CASE 
            WHEN i."invoiceType" ILIKE '%abono%' THEN -1 * EXTRACT(DAY FROM (i."billingEnd" - i."billingStart"))
            ELSE EXTRACT(DAY FROM (i."billingEnd" - i."billingStart")) 
          END
        ) as "days"
      FROM "Invoice" i
      JOIN "SupplyPoint" sp ON i."supplyPointId" = sp.id
      WHERE i."billingEnd" >= ${subMonths(today, 15)}
        AND i."billingStart" IS NOT NULL
        AND i."billingEnd" IS NOT NULL
      GROUP BY sp."cups", EXTRACT(MONTH FROM i."billingEnd")
    `;

    const m12Map = new Map<string, number>();
    for (const row of (historyM12 as any[])) {
      if (row.days && Number(row.days) > 0) {
        m12Map.set(`${row.cups}_${row.month}`, Number(row.totalMWh) / Number(row.days));
      }
    }

    // M0
    const m0Start = startOfMonth(today);
    const m0End = endOfMonth(today);
    // M-1
    const m1Start = startOfMonth(subMonths(today, 1));
    const m1End = endOfMonth(subMonths(today, 1));
    // M-2
    const m2Start = startOfMonth(subMonths(today, 2));
    const m2End = endOfMonth(subMonths(today, 2));

    // -- PRECALCULATE INDEXED COSTS & TARIFF PROFILES ROBUSTLY --
    const tariffIndexedPrices = new Map<string, Record<number, number>>();
    
    const datesToQuery = [];
    for (let d = new Date(m2Start); d <= m0End; d.setDate(d.getDate() + 1)) {
      datesToQuery.push(new Date(d.toISOString().split('T')[0] + 'T00:00:00Z'));
    }

    const priceData = await prisma.systemComponentPrice.findMany({
      where: {
        date: { in: datesToQuery },
        component: { in: ['OMIE'] }
      }
    });

    const omieMap = new Map<string, number>();
    for (const pd of priceData) {
      const dKey = pd.date.toISOString().split('T')[0];
      const m = pd.date.getMonth() + 1;
      let dailySum = 0;
      let validHours = 0;
      const numVals = pd.values.length >= 96 ? 96 : 24;
      for(let i=0; i<numVals; i++) {
        if((pd.values as number[])[i] > 0) { dailySum += (pd.values as number[])[i]; validHours++; }
      }
      if(validHours>0) {
        omieMap.set(`${m}_${dKey}`, dailySum / validHours);
      }
    }

    const m0Num = m0Start.getMonth() + 1;
    const m1Num = m1Start.getMonth() + 1;
    const m2Num = m2Start.getMonth() + 1;

    const m0Key = m0Start.getFullYear() * 100 + m0Num;

    const monthOmieSum = { [m0Num]: {sum:0, c:0}, [m1Num]: {sum:0, c:0}, [m2Num]: {sum:0, c:0} };
    for (const [k, v] of omieMap.entries()) {
      const m = parseInt(k.split('_')[0]);
      if (monthOmieSum[m]) {
        monthOmieSum[m].sum += v;
        monthOmieSum[m].c++;
      }
    }

    const futurePrice = await prisma.futurePrice.findMany({ where: { month: { in: [m0Key] } } });
    const futureM0 = futurePrice.length > 0 ? futurePrice[0].price : 80;

    const getMonthBaseMarket = (m: number) => {
       if (monthOmieSum[m].c > 15) return monthOmieSum[m].sum / monthOmieSum[m].c;
       if (m === m0Num) return futureM0;
       return monthOmieSum[m].c > 0 ? (monthOmieSum[m].sum / monthOmieSum[m].c) : 80;
    };
    
    const regCosts = await prisma.regulatedCost.findMany({
      where: {
        OR: [{ tariff: '2.0TD' }, { tariff: '3.0TD' }, { tariff: '6.1TD' }, { tariff: 'TODAS' }],
        validTo: { gte: m2Start }
      }
    });

    for (const t of ['2.0TD', '3.0TD', '6.1TD']) {
      let regTotal = 0;
      let capFnee = 0;
      for (const reg of regCosts) {
        if (reg.tariff === t || reg.tariff === 'TODAS') {
           if (reg.concept === 'CAPACIDAD' || reg.concept === 'FNEE') capFnee += reg.singleValue || 0;
           else if (reg.concept === 'PEAJES' || reg.concept === 'CARGOS') {
              const p1 = (reg as any)['p1'] || 0;
              const p6 = (reg as any)['p6'] || (reg as any)['p3'] || p1;
              regTotal += ((p1 + p6)/2) * 1000;
           }
        }
      }
      
      const mPrices: Record<number, number> = {};
      for (const m of [m0Num, m1Num, m2Num]) {
        const base = getMonthBaseMarket(m);
        const energyPure = base + 2 + 3 + 3.5; // base + OS + RESTR + DESVIO (estimado medio)
        const lossFactor = t === '2.0TD' ? 1.15 : (t === '3.0TD' ? 1.08 : 1.04);
        const energyLosses = energyPure * lossFactor;
        mPrices[m] = energyLosses + regTotal + capFnee;
      }
      tariffIndexedPrices.set(t, mPrices);
    }

    const cupsMaxBilledDate = new Map<string, Date>();

    // First pass: determine the true max billed date per CUPS (including Airtable fallbacks)
    for (const row of (contractsRaw as any[])) {
      const { cups, airtableData } = row;
      let { lastBilledDate } = row;

      if (airtableData) {
        const airData = typeof airtableData === 'string' ? JSON.parse(airtableData) : airtableData;
        const pmUpper = row.pricingModel?.toUpperCase() || '';
        let isFixedModel = false;
        if (pmUpper === 'FIJO' || pmUpper === 'FIXED') {
          isFixedModel = true;
        } else if (pmUpper === 'INDEXADO' || pmUpper === 'INDEX') {
          isFixedModel = false;
        } else {
          isFixedModel = Boolean(airData && (airData['FIJO / INDEX'] === 'F' || airData['FIJO / INDEX'] === 'FIJO'));
        }
        if (isFixedModel && !cupsMaxBilledDate.has('logged_air_keys')) {
          console.log("=== AIRDATA DEBUG ===");
          console.log("Pricing Model for this row:", row.pricingModel);
          console.log("KEYS:", Object.keys(airData));
          console.log("P1E keys:", Object.keys(airData).filter(k => k.toLowerCase().includes('p1') || k.toLowerCase().includes('precio')));
          console.log("Values for those keys:", Object.keys(airData).filter(k => k.toLowerCase().includes('p1') || k.toLowerCase().includes('precio')).map(k => `${k}: ${airData[k]}`));
          cupsMaxBilledDate.set('logged_air_keys', new Date());
        }
        let airDateStr = airData["ULT DIA FACT"] || airData["ULTIMO DIA FACTURADO"];
        if (airDateStr) {
          const airDate = new Date(airDateStr);
          if (!isNaN(airDate.getTime())) {
            if (!lastBilledDate || airDate > new Date(lastBilledDate)) {
              lastBilledDate = airDate;
            }
          }
        }
      }

      if (lastBilledDate) {
        const dateObj = new Date(lastBilledDate);
        const existing = cupsMaxBilledDate.get(cups);
        if (!existing || dateObj > existing) {
          cupsMaxBilledDate.set(cups, dateObj);
        }
      }
    }

    const results: PendingEnergyData[] = [];

    // Second pass: calculate pending energy using the global CUPS max billed date
    for (const row of (contractsRaw as any[])) {
      const { contractId, contractCode, status, activationDate, terminationDate, annualConsumption, cups, pricingModel, fee, tariff } = row;
      
      const lastBilledDate = cupsMaxBilledDate.get(cups) || null;

      const startCalculo = lastBilledDate ? new Date(lastBilledDate) : new Date(activationDate);
      if (lastBilledDate) {
        startCalculo.setDate(startCalculo.getDate() + 1);
      }

      const endCalculo = terminationDate ? new Date(terminationDate) : m0End;

      if (startCalculo > endCalculo) {
        continue;
      }

      const dailyConsumption = (annualConsumption || 0) / 365; // value is already in MWh or small scale

      const getSeasonalDailyConsumption = (targetMonth: Date) => {
        // Aplicar estacionalidad M-12 solo si el consumo anual es grande (> 40 MWh)
        if (!annualConsumption || annualConsumption < 40) return dailyConsumption;
        
        const monthNum = targetMonth.getMonth() + 1;
        const seasonalDaily = m12Map.get(`${cups}_${monthNum}`);
        return seasonalDaily !== undefined ? seasonalDaily : dailyConsumption;
      };

      const getMWhInPeriod = (pStart: Date, pEnd: Date, targetMonth: Date) => {
        const overlapStart = startCalculo > pStart ? startCalculo : pStart;
        const overlapEnd = endCalculo < pEnd ? endCalculo : pEnd;
        if (overlapEnd < overlapStart) return { days: 0, mwh: 0 };
        const days = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1; // inclusive
        return { days, mwh: days * getSeasonalDailyConsumption(targetMonth) };
      };

      const m0Data = getMWhInPeriod(m0Start, m0End, m0Start);
      const m1Data = getMWhInPeriod(m1Start, m1End, m1Start);
      const m2Data = getMWhInPeriod(m2Start, m2End, m2Start);
      
      const totalPendingDays = m0Data.days + m1Data.days + m2Data.days; // This is a rough estimation of total days if they span exactly these 3 months
      // Calculate true total days for the entire period
      const trueTotalDays = Math.floor((endCalculo.getTime() - startCalculo.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (trueTotalDays <= 0) continue;

      // The total pending MWh is the sum of the months we track + the rest as linear
      const trackedMwh = m0Data.mwh + m1Data.mwh + m2Data.mwh;
      const trackedDays = m0Data.days + m1Data.days + m2Data.days;
      const untrackedDays = trueTotalDays - trackedDays;
      const untrackedMwh = untrackedDays > 0 ? untrackedDays * dailyConsumption : 0;
      const totalPendingMWh = trackedMwh + untrackedMwh;

      // ESTIMACION EN EUROS
      const tariffKey = tariff || '2.0TD';
      let safeTariff = tariff;
      if (!safeTariff || (!safeTariff.includes('2.0TD') && !safeTariff.includes('3.0TD') && !safeTariff.includes('6.1TD'))) safeTariff = '2.0TD';
      
      let priceM0 = 0;
      let priceM1 = 0;
      let priceM2 = 0;
      
      let airData: any = null;
      if (row.airtableData) {
        airData = typeof row.airtableData === 'string' ? JSON.parse(row.airtableData) : row.airtableData;
      }
      
      const pmUpper = pricingModel?.toUpperCase() || '';
      let isFixed = false;
      if (pmUpper === 'FIJO' || pmUpper === 'FIXED') {
        isFixed = true;
      } else if (pmUpper === 'INDEXADO' || pmUpper === 'INDEX') {
        isFixed = false;
      } else {
        isFixed = Boolean(airData && (airData['FIJO / INDEX'] === 'F' || airData['FIJO / INDEX'] === 'FIJO'));
      }
      
      const getAirVal = (key: string) => {
        if (!airData) return 0;
        return Number(airData[key] || airData[`${key} (from PRODUCTOS)`] || airData[`PRECIO ${key}`]) || 0;
      };

      const fallbackP1E = getAirVal('P1E') || getAirVal('P1 E') || getAirVal('P1E (from PRODUCTOS)') || getAirVal('PRECIO P1E') || getAirVal('Precio P1E') || getAirVal('Precio Energía P1');
      if (isFixed && airData && !cupsMaxBilledDate.has('logged_p1e')) {
         console.log("=> Extracted fallbackP1E:", fallbackP1E, "from dbP1e:", row.p1e);
         cupsMaxBilledDate.set('logged_p1e', new Date());
      }
      
      const contractFee = (Number(fee) || 0) < 2 && (Number(fee) || 0) > 0 ? Number(fee) * 1000 : (Number(fee) || 0);
      
      if (isFixed) {
        // En perfil fijo, hacemos una media básica de los periodos sin REE para agilidad
        let blended = 0;
        const parseP = (v: any, fallback: number) => { const n = Number(v) || fallback; return n < 2 && n > 0 ? n * 1000 : n; };
        
        let dbP1e = Number(row.p1e);
        if (!dbP1e && fallbackP1E) dbP1e = fallbackP1E;
        
        const p1 = parseP(dbP1e, 0);
        const p2 = parseP(row.p2e || getAirVal('P2E') || getAirVal('P2 E') || getAirVal('P2E (from PRODUCTOS)'), p1);
        const p3 = parseP(row.p3e || getAirVal('P3E') || getAirVal('P3 E') || getAirVal('P3E (from PRODUCTOS)'), p1);
        const p4 = parseP(row.p4e || getAirVal('P4E') || getAirVal('P4 E') || getAirVal('P4E (from PRODUCTOS)'), p1);
        const p5 = parseP(row.p5e || getAirVal('P5E') || getAirVal('P5 E') || getAirVal('P5E (from PRODUCTOS)'), p1);
        const p6 = parseP(row.p6e || getAirVal('P6E') || getAirVal('P6 E') || getAirVal('P6E (from PRODUCTOS)'), p1);

        blended += p1 * 0.16;
        blended += p2 * 0.16;
        blended += p3 * (safeTariff === '2.0TD' ? 0.68 : 0.16);
        blended += p4 * (safeTariff === '2.0TD' ? 0 : 0.16);
        blended += p5 * (safeTariff === '2.0TD' ? 0 : 0.16);
        blended += p6 * (safeTariff === '2.0TD' ? 0 : 0.20);
        
        priceM0 = blended + contractFee;
        priceM1 = blended + contractFee;
        priceM2 = blended + contractFee;
      } else {
        priceM0 = (tariffIndexedPrices.get(safeTariff)?.[m0Num] || 120) + contractFee;
        priceM1 = (tariffIndexedPrices.get(safeTariff)?.[m1Num] || 120) + contractFee;
        priceM2 = (tariffIndexedPrices.get(safeTariff)?.[m2Num] || 120) + contractFee;
      }

      const isYearlyPower = (Number(row.p1p) || 0) > 2 || (getAirVal('P1P') || getAirVal('P1 P')) > 2;
      const getPowerCost = (days: number) => {
        if (days <= 0) return 0;
        const multiplier = isYearlyPower ? (days / 365.0) : days;
        const p1p = Number(row.p1p || getAirVal('P1P') || 0);
        const p2p = Number(row.p2p || getAirVal('P2P') || p1p);
        const p3p = Number(row.p3p || getAirVal('P3P') || p1p);
        const p4p = Number(row.p4p || getAirVal('P4P') || p1p);
        const p5p = Number(row.p5p || getAirVal('P5P') || p1p);
        const p6p = Number(row.p6p || getAirVal('P6P') || p1p);
        return (Number(row.p1c || getAirVal('P1C') || 0) * p1p + Number(row.p2c || getAirVal('P2C') || 0) * p2p + Number(row.p3c || getAirVal('P3C') || 0) * p3p + Number(row.p4c || getAirVal('P4C') || 0) * p4p + Number(row.p5c || getAirVal('P5C') || 0) * p5p + Number(row.p6c || getAirVal('P6C') || 0) * p6p) * multiplier;
      };

      const m0PowerCost = getPowerCost(m0Data.days);
      const m1PowerCost = getPowerCost(m1Data.days);
      const m2PowerCost = getPowerCost(m2Data.days);
      const untrackedPowerCost = getPowerCost(untrackedDays);
      
      const applyMunicipalTax = !isFixed ? 1.015 : 1.0;
      
      const m0Euros = ((m0Data.mwh * priceM0) + m0PowerCost) * applyMunicipalTax;
      const m1Euros = ((m1Data.mwh * priceM1) + m1PowerCost) * applyMunicipalTax;
      const m2Euros = ((m2Data.mwh * priceM2) + m2PowerCost) * applyMunicipalTax;
      
      const avgPrice = (priceM0 + priceM1 + priceM2) / 3 || 0;
      const untrackedEuros = ((untrackedMwh * avgPrice) + untrackedPowerCost) * applyMunicipalTax;

      const estimatedEurosRaw = m0Euros + m1Euros + m2Euros + untrackedEuros;
      const estimatedEurosWithTaxes = estimatedEurosRaw * 1.05113 * 1.21;

      results.push({
        contractId,
        contractCode: contractCode || 'Sin Código',
        cups: cups || '',
        status,
        lastBilledDate: lastBilledDate ? new Date(lastBilledDate).toISOString() : null,
        annualConsumption: Number(annualConsumption) || 0,
        totalPendingDays: trueTotalDays,
        totalPendingMWh,
        m0PendingMWh: m0Data.mwh,
        m1PendingMWh: m1Data.mwh,
        m2PendingMWh: m2Data.mwh,
        m0Euros,
        m1Euros,
        m2Euros,
        estimatedEurosRaw,
        estimatedEurosWithTaxes,
      });
    }

    // Sort by oldest lastBilledDate first, then totalPendingMWh DESC
    results.sort((a, b) => {
      const dateA = a.lastBilledDate ? new Date(a.lastBilledDate).getTime() : 0;
      const dateB = b.lastBilledDate ? new Date(b.lastBilledDate).getTime() : 0;
      
      if (dateA !== dateB) {
        return dateA - dateB; // Oldest first
      }
      return b.totalPendingMWh - a.totalPendingMWh; // Largest MWh first
    });

    return { success: true, data: results };

  } catch (error: any) {
    console.error('Error fetching pending energy:', error);
    return { success: false, error: error.message };
  }
}
