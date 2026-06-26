import { prisma } from '../prisma';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

export interface SipsPeriod {
  p1: number; p2: number; p3: number; p4: number; p5: number; p6: number;
}

export interface PricingParams {
  tariff: string;
  margin: number;
  deviations: number;
  annualConsumptionKwh?: number;
  sipsData?: SipsPeriod; 
  cchData?: number[]; 
  startDate: string; // YYYY-MM-DD
  durationMonths: number;
  riskLevel: number; 
}

export interface HourlyDetail {
  datetime: string;
  per: string;
  consumoKwh: number;
  baseMercadoEur: number;
  restriccionesEur: number;
  osEur: number;
  desviosEur: number;
  energiaPuraEur: number;
  lossFactor: number;
  costeConPerdidasEur: number;
  regTotalEur: number;
  margenEur: number;
  subtotalEur: number;
  tasaMunicEur: number;
  precioFinalEur: number;
  absTotalEur: number;
}

export interface QuoteResult {
  flatPriceEurMwh: number;
  periods: Record<string, { priceEurMwh: number, percentage: number, costEurMwh: number }>;
  breakdown: {
    energyCostEur: number;
    lossesCostEur: number;
    regulatedCostEur: number;
    marginEur: number;
    totalEur: number;
  };
  hourlyDetails: HourlyDetail[];
}

async function smartMergeDB(dates: Date[], compName: string, risk: number): Promise<number[]> {
  const tStart = dates[0].getTime();
  const tEnd = dates[dates.length - 1].getTime();

  const minT1 = new Date(tStart - (728 * 24 * 3600 * 1000));
  minT1.setHours(0,0,0,0);
  const maxT1 = new Date(tEnd - (364 * 24 * 3600 * 1000));
  maxT1.setHours(23,59,59,999);

  const compData = await prisma.systemComponentPrice.findMany({
    where: {
      component: compName,
      date: {
        gte: minT1,
        lte: maxT1
      }
    }
  });

  const mapData = new Map<string, number[]>();
  for (const row of compData) {
    const key = row.date.toISOString().split('T')[0];
    mapData.set(key, row.values);
  }

  return dates.map(dt => {
    const dt1 = new Date(dt);
    dt1.setDate(dt1.getDate() - 364);
    const dt2 = new Date(dt);
    dt2.setDate(dt2.getDate() - 728);
    
    const k1 = dt1.toISOString().split('T')[0];
    const k2 = dt2.toISOString().split('T')[0];
    
    const h1 = dt1.getHours();
    const h2 = dt2.getHours();

    const v1 = mapData.get(k1)?.[h1] ?? null;
    const v2 = mapData.get(k2)?.[h2] ?? null;

    let validVals = [v1, v2].filter((v): v is number => v !== null && v !== 0);
    
    if (validVals.length === 0) {
      return compName === 'RESTRICCIONES' ? 5.0 : (compName === 'OS' ? 2.0 : 0.18);
    }

    if (risk === 1) return Math.max(...validVals);
    if (risk === 3) return Math.min(...validVals);
    return validVals.reduce((a, b) => a + b, 0) / validVals.length;
  });
}

export class PricingEngine {
  
  static getPeriodo(dt: Date, tariff: string, isHoliday: boolean): string {
    const m = dt.getUTCMonth() + 1;
    const h = dt.getUTCHours();
    const w = dt.getUTCDay(); 
    const isWeekend = (w === 0 || w === 6);
    const isHol = isHoliday || isWeekend;
    
    if (tariff === '2.0TD') {
      if (isHol || (h >= 0 && h < 8)) return 'P3';
      if ([8, 9, 14, 15, 16, 17, 22, 23].includes(h)) return 'P2';
      return 'P1';
    }
    
    if (isHol || (h >= 0 && h < 8)) return 'P6';
    if ([1, 2, 7, 12].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P1' : 'P2';
    if ([3, 11].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P2' : 'P3';
    if ([6, 8, 9].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P3' : 'P4';
    return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P4' : 'P5';
  }

  static async generateQuote(params: PricingParams): Promise<QuoteResult> {
    const { tariff, margin, deviations, startDate, sipsData, cchData, annualConsumptionKwh, durationMonths = 12, riskLevel = 2 } = params;
    const start = new Date(startDate + 'T00:00:00Z');
    const targetYear = start.getUTCFullYear();
    
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + durationMonths);
    const totalHours = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    const dates: Date[] = [];
    for (let i = 0; i < totalHours; i++) {
      const d = new Date(start);
      d.setUTCHours(d.getUTCHours() + i);
      dates.push(d);
    }
    
    let reeProfiles: Record<string, number> = {};
    let sumCoefByPeriod: Record<string, number> = { P1:0, P2:0, P3:0, P4:0, P5:0, P6:0 };
    let isSips = !!sipsData;
    let totalAnnual = isSips ? Object.values(sipsData!).reduce((a,b)=>a+b, 0) : (annualConsumptionKwh || 10000);

    const reeData = await prisma.reeProfile.findMany({
      where: { year: targetYear }
    });

    let perfilesUsar = reeData;
    if (perfilesUsar.length === 0) {
      const maxYearData = await prisma.reeProfile.findFirst({ orderBy: { year: 'desc' }});
      if (maxYearData) {
        perfilesUsar = await prisma.reeProfile.findMany({ where: { year: maxYearData.year }});
      }
    }

    const tipoPerfil = tariff.includes('2.0') ? 'p20td' : (tariff.includes('3.0TDVE') ? 'p30tdve' : 'p30td');

    const profileGroups: Record<string, number[]> = {};

    for (const r of perfilesUsar) {
      const coef = (r as any)[tipoPerfil] || 0.0001;
      const simDate = new Date(Date.UTC(perfilesUsar[0].year, r.month - 1, r.day, r.hour));
      const w = simDate.getUTCDay();
      const key = `${r.month}-${w}-${r.hour}`;
      if (!profileGroups[key]) profileGroups[key] = [];
      profileGroups[key].push(coef);
    }

    for (const [key, arr] of Object.entries(profileGroups)) {
      reeProfiles[key] = arr.reduce((a,b)=>a+b,0) / arr.length;
    }

    // Calcular la suma teórica por periodo usando un año base para que sumCoefByPeriod sea correcto
    for (let m=1; m<=12; m++) {
      for (let d=1; d<=31; d++) {
        const dt = new Date(Date.UTC(targetYear, m-1, d, 0));
        if (dt.getUTCMonth() + 1 !== m) continue;
        const w = dt.getUTCDay();
        for (let h=0; h<24; h++) {
          const key = `${m}-${w}-${h}`;
          const coef = reeProfiles[key] || 0.0001;
          const p = this.getPeriodo(new Date(Date.UTC(targetYear, m-1, d, h)), tariff, false);
          sumCoefByPeriod[p] += coef;
        }
      }
    }

    const futuros = await prisma.futurePrice.findMany();
    const futureMap = new Map(futuros.map(f => [f.month, f.price]));
    
    const startYear = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0));
    const endYearObj = new Date(startYear);
    endYearObj.setUTCFullYear(startYear.getUTCFullYear() + Math.ceil(durationMonths / 12));
    const endYear = new Date(Date.UTC(endYearObj.getUTCFullYear(), 11, 31, 23, 59, 59));
    
    const portfolioBaseData = await prisma.portfolioBaseCurve.findMany({
      where: { datetime: { gte: startYear, lte: endYear } }
    });
    
    if (portfolioBaseData.length === 0) {
      throw new Error('[CRÍTICO] La tabla PortfolioBaseCurve está completamente vacía para este periodo. Por favor, haz clic en "Sincronizar Portfolio Ahora" en la barra superior. No se aplicará el fallback de seguridad.');
    }
    const portfolioMap = new Map<string, number>();
    for (const c of portfolioBaseData) {
      const y = c.datetime.getUTCFullYear();
      const m = c.datetime.getUTCMonth() + 1;
      const d = c.datetime.getUTCDate();
      const h = c.datetime.getUTCHours();
      portfolioMap.set(`${y}-${m}-${d}-${h}`, c.basePriceEurMwh);
    }
    
    const regulated = await prisma.regulatedCost.findMany({
      where: {
        OR: [{ tariff }, { tariff: 'TODAS' }],
        validFrom: { lte: start },
        validTo: { gte: start }
      }
    });

    // Smart Merge for exact risk parity
    const restriccionesArr = await smartMergeDB(dates, 'RESTRICCIONES', riskLevel);
    const osArr = await smartMergeDB(dates, 'OS', riskLevel);
    let lossCol = 'PERD_30TD';
    if (tariff.includes('2.0')) lossCol = 'PERD_20TD';
    if (tariff.includes('6.1')) lossCol = 'PERD_61TD';
    const perdArr = await smartMergeDB(dates, lossCol, riskLevel);

    let totalEnergyCostEur = 0;
    let totalLossesCostEur = 0;
    let totalRegulatedCostEur = 0;
    let totalMarginEur = 0;
    
    const periodsBreakdown: Record<string, any> = {};
    for (const p of ['P1','P2','P3','P4','P5','P6']) {
      periodsBreakdown[p] = { consumption: 0, costAbs: 0, energyAbs: 0, lossAbs: 0, regAbs: 0 };
    }

    const hourlyDetails: HourlyDetail[] = [];
    let i = 0;
    
    // TWO-PASS VOLUMETRIC NORMALIZATION
    // 1. Calculate raw hourly volumes and sum them up
    const rawHourlyKwh: number[] = new Array(dates.length).fill(0);
    let sumRawKwh = 0;
    for (let j = 0; j < dates.length; j++) {
      const dt = dates[j];
      const p = this.getPeriodo(dt, tariff, false);
      const m = dt.getUTCMonth() + 1;
      const w = dt.getUTCDay();
      
      if (cchData && cchData.length > 0) {
        rawHourlyKwh[j] = cchData[j % cchData.length];
      } else if (isSips && sipsData) {
        const sipsTotalPeriod = (sipsData as any)[p.toLowerCase()] || 0;
        const key = `${m}-${w}-${dt.getUTCHours()}`;
        const coef = reeProfiles[key] || 0.0001;
        const sumCoef = sumCoefByPeriod[p] || 1;
        rawHourlyKwh[j] = (sipsTotalPeriod * coef) / sumCoef;
      } else {
        const key = `${m}-${w}-${dt.getUTCHours()}`;
        const coef = reeProfiles[key] || (1 / (365*24));
        rawHourlyKwh[j] = coef;
      }
      sumRawKwh += rawHourlyKwh[j];
    }
    
    // 2. Target consumption for the whole period (scaling annual to duration)
    const targetPeriodConsumption = isSips ? totalAnnual : (totalAnnual * (dates.length / 8760));
    
    for (const dt of dates) {
      const p = this.getPeriodo(dt, tariff, false);
      const m = dt.getMonth() + 1;
      
      let hourlyKwh = rawHourlyKwh[i];
      // Normalize if not CCH
      if (!(cchData && cchData.length > 0) && sumRawKwh > 0) {
        hourlyKwh = (hourlyKwh / sumRawKwh) * targetPeriodConsumption;
      }
      
      const portfolioKey = `${dt.getUTCFullYear()}-${dt.getUTCMonth() + 1}-${dt.getUTCDate()}-${dt.getUTCHours()}`;
      const baseMercado = portfolioMap.get(portfolioKey);
      
      if (baseMercado === undefined) {
        throw new Error(`[CRÍTICO] Faltan datos en la Curva Base del Portfolio para la fecha ${portfolioKey}. Esto suele ocurrir si la orquestación ha fallado. Por favor, haz clic en "Sincronizar Portfolio Ahora" para regenerar la curva. No se aplicará fallback de seguridad.`);
      }
      
      const unitRestricciones = restriccionesArr[i];
      const unitOs = osArr[i];
      const unitDesvios = deviations;
      
      let lossPct = perdArr[i];
      if (lossPct > 2.0) lossPct /= 100.0;
      const lossF = 1 + lossPct;

      const unitEnergiaPura = baseMercado + unitRestricciones + unitOs + unitDesvios;
      const unitCosteConPerdidas = unitEnergiaPura * lossF;
      
      let unitRegTotal = 0;
      for (const reg of regulated) {
        if (reg.singleValue) unitRegTotal += reg.singleValue;
        else {
          const val = (reg as any)[p.toLowerCase()];
          if (val) unitRegTotal += (val * 1000);
        }
      }

      const unitSubtotal = unitCosteConPerdidas + unitRegTotal + margin;
      const unitPrecioFinal = unitSubtotal * 1.015; // + Tasa Munic
      
      const mwh = hourlyKwh / 1000.0;
      const absTotal = unitPrecioFinal * mwh;
      
      totalEnergyCostEur += (unitEnergiaPura * mwh);
      totalLossesCostEur += ((unitCosteConPerdidas - unitEnergiaPura) * mwh);
      totalRegulatedCostEur += (unitRegTotal * mwh);
      totalMarginEur += (margin * mwh);

      periodsBreakdown[p].consumption += hourlyKwh;
      periodsBreakdown[p].costAbs += absTotal;
      periodsBreakdown[p].energyAbs += (unitEnergiaPura * mwh);
      periodsBreakdown[p].lossAbs += ((unitCosteConPerdidas - unitEnergiaPura) * mwh);
      periodsBreakdown[p].regAbs += (unitRegTotal * mwh);
      
      hourlyDetails.push({
        datetime: dt.toISOString(),
        per: p,
        consumoKwh: hourlyKwh,
        baseMercadoEur: baseMercado,
        restriccionesEur: unitRestricciones,
        osEur: unitOs,
        desviosEur: unitDesvios,
        energiaPuraEur: unitEnergiaPura,
        lossFactor: lossF,
        costeConPerdidasEur: unitCosteConPerdidas,
        regTotalEur: unitRegTotal,
        margenEur: margin,
        subtotalEur: unitSubtotal,
        tasaMunicEur: unitSubtotal * 0.015,
        precioFinalEur: unitPrecioFinal,
        absTotalEur: absTotal
      });

      i++;
    }
    
    const totalEur = totalEnergyCostEur + totalLossesCostEur + totalRegulatedCostEur + totalMarginEur;
    const finalEur = totalEur * 1.015;
    const flatPriceEurMwh = (finalEur / (totalAnnual / 1000));
    
    const periodsResult: Record<string, any> = {};
    for (const p of ['P1','P2','P3','P4','P5','P6']) {
      const pb = periodsBreakdown[p];
      if (pb.consumption > 0) {
        periodsResult[p] = {
          priceEurMwh: pb.costAbs / (pb.consumption / 1000),
          percentage: (pb.consumption / totalAnnual) * 100,
          costEurMwh: (pb.costAbs / (pb.consumption / 1000)) - margin
        };
      }
    }

    return {
      flatPriceEurMwh,
      periods: periodsResult,
      breakdown: {
        energyCostEur: totalEnergyCostEur,
        lossesCostEur: totalLossesCostEur,
        regulatedCostEur: totalRegulatedCostEur,
        marginEur: totalMarginEur,
        totalEur: finalEur
      },
      hourlyDetails
    };
  }
}
