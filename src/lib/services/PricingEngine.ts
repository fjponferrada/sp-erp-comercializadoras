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
  sumCompsEur: number;
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
  const startD = dates[0];
  const endD = dates[dates.length - 1];

  const minYear = startD.getUTCFullYear() - 2;
  const minMonth = startD.getUTCMonth();
  const minT1 = new Date(Date.UTC(minYear, minMonth, 1, 0, 0, 0));

  const maxYear = endD.getUTCFullYear() - 1;
  const maxMonth = endD.getUTCMonth();
  const maxT1 = new Date(Date.UTC(maxYear, maxMonth + 1, 0, 23, 59, 59, 999));

  const compData = await prisma.systemComponentPrice.findMany({
    where: {
      component: compName,
      date: {
        gte: minT1,
        lte: maxT1
      }
    }
  });

  const valuesByPeriod: Record<string, number[]> = {};

  for (const row of compData) {
    const y = row.date.getUTCFullYear();
    const m = row.date.getUTCMonth();
    const w = row.date.getUTCDay();

    for (let h = 0; h < 24; h++) {
      let val = null;
      if (row.values.length === 96) {
        val = ((row.values[h*4] || 0) + (row.values[h*4+1] || 0) + (row.values[h*4+2] || 0) + (row.values[h*4+3] || 0)) / 4;
      } else {
        val = row.values[h] ?? null;
      }

      if (val !== null && val !== 0) {
        const key = `${y}-${m}-${w}-${h}`;
        if (!valuesByPeriod[key]) valuesByPeriod[key] = [];
        valuesByPeriod[key].push(val);
      }
    }
  }

  const avgByPeriod: Record<string, number> = {};
  for (const [key, arr] of Object.entries(valuesByPeriod)) {
    avgByPeriod[key] = arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  return dates.map(dt => {
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    const w = dt.getUTCDay();
    const h = dt.getUTCHours();

    const y1 = y - 1;
    const y2 = y - 2;

    const v1 = avgByPeriod[`${y1}-${m}-${w}-${h}`] ?? null;
    const v2 = avgByPeriod[`${y2}-${m}-${w}-${h}`] ?? null;

    let validVals = [v1, v2].filter((v): v is number => v !== null);

    if (validVals.length === 0) {
      if (compName === 'RESTRICCIONES') return 5.0;
      if (compName === 'OS') return 2.0;
      if (compName === 'K') return 1.0;
      return 0.18;
    }

    if (risk === 1) return Math.max(...validVals);
    if (risk === 3) return Math.min(...validVals);
    return validVals.reduce((a, b) => a + b, 0) / validVals.length;
  });
}

export class PricingEngine {
  
  static getPeriodo(dt: Date, tariff: string, isHoliday: boolean): string {
    const localStr = dt.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
    const y = parseInt(localStr.substring(0, 4), 10);
    const m = parseInt(localStr.substring(5, 7), 10);
    const d = parseInt(localStr.substring(8, 10), 10);
    const h = parseInt(localStr.substring(11, 13), 10);
    
    const localDateObj = new Date(y, m - 1, d);
    const w = localDateObj.getDay(); 
    const isWeekend = (w === 0 || w === 6);
    const isHol = isHoliday || isWeekend;
    
    if (tariff === '2.0TD' || tariff.includes('2.0')) {
      if (isHol || (h >= 0 && h < 8)) return 'P3';
      if ([8, 9, 14, 15, 16, 17, 22, 23].includes(h)) return 'P2';
      return 'P1';
    }
    
    if (isHol || (h >= 0 && h < 8)) return 'P6';
    if ([1, 2, 7, 12].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P1' : 'P2';
    if ([3, 11].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P2' : 'P3';
    if ([4, 5, 10].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P4' : 'P5';
    if ([6, 8, 9].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P3' : 'P4';
    
    return 'P6';
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
    const individualComps = ['RT3', 'RT6', 'CT2', 'CT3', 'BS3', 'RAD3', 'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP'];
    const compsArrays: Record<string, number[]> = {};
    for (const c of individualComps) {
       compsArrays[c] = await smartMergeDB(dates, c, riskLevel);
    }
    

    
    // Fetch K
    const kArr = await smartMergeDB(dates, 'K', riskLevel);
    
    // Fetch BOE Perdidas from regulatedCosts matching tariff
    const boeRecord = regulated.find(c => c.concept === 'PERDIDAS' && c.tariff === tariff);

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
      const baseVal = portfolioMap.get(portfolioKey);
      
      if (baseVal === undefined) {
        throw new Error(`[CRÍTICO] Faltan datos en la Curva Base del Portfolio para la fecha ${portfolioKey}. Esto suele ocurrir si la orquestación ha fallado. Por favor, haz clic en "Sincronizar Portfolio Ahora" para regenerar la curva. No se aplicará fallback de seguridad.`);
      }
      
      const dsvVal = (deviations !== undefined && deviations !== null) ? deviations : 2.0;
      const kFactor = kArr[i] || 1;

      let sumComps = 0;
      for (const c of individualComps) {
         sumComps += compsArrays[c][i] || 0;
      }
      
      const baseMercado = baseVal;

      let lossPct = 0;
      if (boeRecord) {
        const periodStr = this.getPeriodo(dt, tariff, false);
        const pVal = boeRecord[periodStr.toLowerCase() as keyof typeof boeRecord] as number | null;
        if (pVal !== null && pVal !== undefined) {
          lossPct = pVal * kFactor;
        }
      }
      if (lossPct > 2.0) lossPct /= 100.0;
      const lossF = 1 + lossPct;

      let regLossAffected = 0;
      let regNonLossTaxable = 0;
      let regNonTaxableAtr = 0;

      for (const reg of regulated) {
        const conceptLow = reg.concept.toLowerCase();
        // Skip PERDIDAS as it's a percentage (already extracted and applied as lossF)
        if (conceptLow === 'perdidas') continue;
        // Skip fixed costs (Términos de Potencia, Bono Social, Alquiler) since this loop is only for energy (€/MWh)
        if (conceptLow.includes('potencia') || conceptLow.includes('fijo') || conceptLow.includes('bono') || conceptLow.includes('alquiler')) continue;

        let val = 0;
        if (reg.singleValue) val = reg.singleValue;
        else {
          const v = (reg as any)[p.toLowerCase()];
          if (v) val = v * 1000;
        }

        if (['capacidad', 'rom', 'ros', 'retribucion', 'pago_om', 'pago_os', 'pago om', 'pago os'].some(k => conceptLow.includes(k))) {
          regLossAffected += val;
        } else if (conceptLow.includes('fnee')) {
          regNonLossTaxable += val;
        } else {
          regNonTaxableAtr += val;
        }
      }

      // 1. Energia Pura includes loss-affected regulated costs
      const unitEnergiaPura = baseMercado + sumComps + dsvVal + regLossAffected;
      const unitCosteConPerdidas = unitEnergiaPura * lossF;
      
      // 2. Subtotal includes non-loss taxable costs (FNEE) and margin
      const taxableSubtotal = unitCosteConPerdidas + regNonLossTaxable + margin;
      
      // 3. Tasa Municipal is 1/0.985 of the taxable subtotal
      const afterTasaSubtotal = taxableSubtotal / 0.985;
      const tasaMunicEur = afterTasaSubtotal - taxableSubtotal;
      
      // 4. Final price includes non-taxable regulated costs (ATR)
      const unitPrecioFinal = afterTasaSubtotal + regNonTaxableAtr;
      
      const unitSubtotal = unitPrecioFinal - tasaMunicEur; // Subtotal used for compatibility

      // Maintain unitRegTotal for backward compatibility
      const unitRegTotal = regLossAffected + regNonLossTaxable + regNonTaxableAtr;
      
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
        sumCompsEur: sumComps,
        desviosEur: dsvVal,
        energiaPuraEur: unitEnergiaPura,
        lossFactor: lossF,
        costeConPerdidasEur: unitCosteConPerdidas,
        regTotalEur: unitRegTotal,
        margenEur: margin,
        subtotalEur: unitSubtotal,
        tasaMunicEur: tasaMunicEur,
        precioFinalEur: unitPrecioFinal,
        absTotalEur: absTotal
      });

      i++;
    }
    
    // Sum absTotal over all periods to get the exact finalEur
    const finalEur = Object.values(periodsBreakdown).reduce((acc: number, pb: any) => acc + pb.costAbs, 0);
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
