import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { fromZonedTime } from 'date-fns-tz';
import { getPeriodoREE } from '../lib/services/InternalBillingEngine';
import { SETTLEMENT_RANKS } from '../lib/reganecuShared';
import { mergeDailyReganecuRecords } from '../lib/reganecuServer';
import { AggregationService } from '../lib/services/AggregationService';

export interface CalculatePendingOptions {
  targetMonths?: string[];
  rebuildAggregates?: boolean;
}

function toUtcDateOnly(d: Date): Date {
  const iso = d.toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

function toHourly24(values: number[] | undefined, fallbackVal: number = 0): number[] {
  if (!values || values.length === 0) {
    return new Array(24).fill(fallbackVal);
  }
  if (values.length >= 96) {
    const out = new Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      const q0 = values[h * 4] ?? fallbackVal;
      const q1 = values[h * 4 + 1] ?? fallbackVal;
      const q2 = values[h * 4 + 2] ?? fallbackVal;
      const q3 = values[h * 4 + 3] ?? fallbackVal;
      out[h] = (q0 + q1 + q2 + q3) / 4;
    }
    return out;
  }
  const out = new Array(24).fill(fallbackVal);
  for (let h = 0; h < Math.min(24, values.length); h++) {
    out[h] = values[h] ?? fallbackVal;
  }
  return out;
}

function normalizeBoeLossPct(rawVal: number | null | undefined): number | null {
  if (rawVal === null || rawVal === undefined || isNaN(rawVal)) return null;
  let v = rawVal;
  if (v > 1.0 && v <= 2.0) v = v - 1.0;
  else if (v > 2.0) v = v / 100.0;
  else if (v < -2.0) v = v / 100.0;
  return v;
}

function prorateEnergyForMonth(
  rawStart: Date,
  rawEnd: Date,
  monthStartUtc: Date,
  monthEndDateOnlyUtc: Date,
  signedMwh: number
): number {
  const sUtc = toUtcDateOnly(rawStart);
  const eUtc = toUtcDateOnly(rawEnd);
  if (eUtc < sUtc) return 0;

  const oStart = sUtc < monthStartUtc ? monthStartUtc : sUtc;
  const oEnd = eUtc > monthEndDateOnlyUtc ? monthEndDateOnlyUtc : eUtc;
  if (oEnd < oStart) return 0;

  const totalDays = Math.round((eUtc.getTime() - sUtc.getTime()) / 86_400_000) + 1;
  const overlapDays = Math.round((oEnd.getTime() - oStart.getTime()) / 86_400_000) + 1;
  return totalDays > 0 ? (signedMwh * overlapDays) / totalDays : 0;
}

function extractF1ActiveEnergyKwh(jsonData: any): number {
  if (!jsonData || typeof jsonData !== 'object') return 0;
  const periodosRaw = jsonData?.EnergiaActiva?.TerminoEnergiaActiva?.Periodo;
  if (!periodosRaw) return 0;
  const periodos = Array.isArray(periodosRaw) ? periodosRaw : [periodosRaw];
  let sumKwh = 0;
  for (const p of periodos) {
    const rawVal = p?.ValorEnergiaActiva;
    if (rawVal === undefined || rawVal === null) continue;
    const parsed = parseFloat(String(rawVal).replace(',', '.'));
    if (!isNaN(parsed)) sumKwh += parsed;
  }
  return sumKwh;
}

function getClosedMonthsList(count: number = 12): string[] {
  const madridToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const [curY, curM] = madridToday.split('-').map(Number);
  const months: string[] = [];
  for (let i = count; i >= 1; i--) {
    const d = new Date(Date.UTC(curY, curM - 1 - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

function getCierreRank(cierre: string): number {
  const upper = (cierre || '').trim().toUpperCase();
  if (SETTLEMENT_RANKS[upper] !== undefined) {
    return SETTLEMENT_RANKS[upper];
  }
  const m = upper.match(/^([AC])(\d+)$/);
  if (!m) return -1;
  const num = parseInt(m[2], 10);
  return (num - 1) * 2 + (m[1] === 'C' ? 2 : 1);
}

export async function runCalculatePendingEnergy(
  onProgress?: (msg: string) => void,
  targetCompanyId?: string,
  options?: CalculatePendingOptions
) {
  console.log(`Iniciando cálculo de energía pendiente. Compañía objetivo: ${targetCompanyId || 'TODAS'}`);
  if (onProgress) onProgress('Iniciando cálculo de energía pendiente...');

  const defaultMonths = getClosedMonthsList(12);
  const maxClosedMonth = defaultMonths[defaultMonths.length - 1];

  let monthsToProcess = defaultMonths;
  if (options?.targetMonths && options.targetMonths.length > 0) {
    const filtered = Array.from(
      new Set(options.targetMonths.filter(m => /^\d{4}-\d{2}$/.test(m) && m <= maxClosedMonth))
    ).sort();
    if (filtered.length > 0) {
      monthsToProcess = filtered;
    }
  }

  const firstMonthParts = monthsToProcess[0].split('-').map(Number);
  const lastMonthParts = monthsToProcess[monthsToProcess.length - 1].split('-').map(Number);
  const startRangeUtc = new Date(Date.UTC(firstMonthParts[0], firstMonthParts[1] - 1, 1, 0, 0, 0, 0));
  const endRangeUtc = new Date(Date.UTC(lastMonthParts[0], lastMonthParts[1], 0, 23, 59, 59, 999));

  let companiesToProcess = [];
  if (targetCompanyId) {
    const comp = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (comp) companiesToProcess.push(comp);
  } else {
    companiesToProcess = await prisma.company.findMany();
  }

  // Cargar costes regulados BOE (PERDIDAS y Pagos_Capacidad) con vigencia temporal
  const regulatedRows = await prisma.regulatedCost.findMany({
    where: { concept: { in: ['PERDIDAS', 'Pagos_Capacidad'] } },
    orderBy: { validFrom: 'asc' },
  });

  const resolveBoeRow = (concept: string, tariff: string, dayUtc: Date) => {
    const cleanTariff = (tariff || '2.0TD').trim().toUpperCase();
    const candidates = [cleanTariff];
    if (cleanTariff === '3.0TDVE') candidates.push('3.0TD');
    else if (cleanTariff === '6.1TDVE') candidates.push('6.1TD');
    else if (cleanTariff === '6.2TDVE') candidates.push('6.2TD', '6.1TD');
    else if (cleanTariff.startsWith('6.')) candidates.push('6.1TD');
    else if (!candidates.includes('2.0TD')) candidates.push('2.0TD');

    for (const cand of candidates) {
      const validMatches = regulatedRows.filter(
        r =>
          r.concept === concept &&
          r.tariff.toUpperCase() === cand &&
          toUtcDateOnly(r.validFrom) <= dayUtc &&
          toUtcDateOnly(r.validTo) >= dayUtc
      );
      if (validMatches.length > 0) return validMatches[validMatches.length - 1];
    }

    for (const cand of candidates) {
      const anyMatches = regulatedRows.filter(r => r.concept === concept && r.tariff.toUpperCase() === cand);
      if (anyMatches.length > 0) return anyMatches[anyMatches.length - 1];
    }

    return null;
  };

  // Cargar componentes del sistema (OMIE, OS, RESTRICCIONES, K y PERD_ legacy)
  const prices = await prisma.systemComponentPrice.findMany({
    where: {
      date: { gte: startRangeUtc, lte: endRangeUtc },
      component: {
        in: ['OMIE', 'OS', 'RESTRICCIONES', 'K', 'PERD_20TD', 'PERD_30TD', 'PERD_30TDVE', 'PERD_61TD'],
      },
    },
  });

  const pricesByDateComponent = new Map<string, number[]>();
  const rawPricesByMonthComp = new Map<string, { sumDailyAvg: number; dayCount: number }>();

  for (const price of prices) {
    const dayKey = price.date.toISOString().slice(0, 10);
    const monthKey = dayKey.slice(0, 7);
    const defaultFill = price.component === 'K' ? 1 : 0;
    pricesByDateComponent.set(`${dayKey}_${price.component}`, toHourly24(price.values, defaultFill));

    if (
      (price.component === 'OMIE' || price.component === 'RESTRICCIONES' || price.component === 'OS') &&
      price.values &&
      price.values.length > 0
    ) {
      const dailyAvg = price.values.reduce((a, b) => a + b, 0) / price.values.length;
      const mCompKey = `${monthKey}_${price.component}`;
      const prev = rawPricesByMonthComp.get(mCompKey) || { sumDailyAvg: 0, dayCount: 0 };
      prev.sumDailyAvg += dailyAvg;
      prev.dayCount += 1;
      rawPricesByMonthComp.set(mCompKey, prev);
    }
  }

  // Caché de periodos horarios REE (P1..P6) en hora local peninsular Europe/Madrid
  const periodCache = new Map<string, string>();
  const getCachedMadridPeriod = (dayKey: string, h: number, tariff: string): string => {
    const is20 = tariff.toUpperCase().includes('2.0TD');
    const cacheKey = `${dayKey}_${h}_${is20 ? '20' : '30_6X'}`;
    let p = periodCache.get(cacheKey);
    if (!p) {
      const zonedDt = fromZonedTime(`${dayKey}T${String(h).padStart(2, '0')}:00:00`, 'Europe/Madrid');
      p = getPeriodoREE(zonedDt, is20 ? '2.0TD' : '3.0TD');
      periodCache.set(cacheKey, p);
    }
    return p;
  };

  for (const company of companiesToProcess) {
    if (onProgress) onProgress(`Procesando compañía: ${company.name}`);
    console.log(`=== PROCESANDO COMPAÑÍA: ${company.name} ===`);

    if (options?.rebuildAggregates) {
      if (onProgress) onProgress(`Reconstruyendo curvas CCH agregadas de 12 meses para ${company.name}...`);
      await AggregationService.regenerateAggregates(380, company.id, onProgress);
    }

    // Precargar AggregatedLoadCurve filtrando estrictamente por companyId
    const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
      where: {
        date: { gte: startRangeUtc, lte: endRangeUtc },
        companyId: company.id,
      },
    });

    const dailyCurvesByTariff = new Map<
      string,
      Record<string, { consumption: number[]; surplus: number[]; clientCount: number }>
    >();

    for (const curve of aggregatedCurves) {
      const dayKey = curve.date.toISOString().slice(0, 10);
      if (!dailyCurvesByTariff.has(dayKey)) {
        dailyCurvesByTariff.set(dayKey, {});
      }
      const dayMap = dailyCurvesByTariff.get(dayKey)!;
      const tariffKey = (curve.tariff || '2.0TD').trim().toUpperCase();
      if (!dayMap[tariffKey]) {
        dayMap[tariffKey] = {
          consumption: new Array(24).fill(0),
          surplus: new Array(24).fill(0),
          clientCount: 0,
        };
      }
      const bucket = dayMap[tariffKey];
      bucket.clientCount += curve.clientCount || 0;

      for (let h = 0; h < 24; h++) {
        bucket.consumption[h] += curve.totalConsumption?.[h] || 0;
        bucket.surplus[h] += curve.totalSurplus?.[h] || 0;
      }
    }

    for (const monthKey of monthsToProcess) {
      const [yearNum, monthNum] = monthKey.split('-').map(Number);
      const monthStartUtc = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0));
      const monthEndDateOnlyUtc = new Date(Date.UTC(yearNum, monthNum, 0, 0, 0, 0, 0));
      const monthEndUtc = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));
      const daysInMonth = monthEndDateOnlyUtc.getUTCDate();

      // 1. Facturas emitidas (Invoice + InternalInvoice emitidas no solapadas) + F1 pendientes de facturar
      const [invoices, internalInvoices, unbilledF1s] = await Promise.all([
        prisma.invoice.findMany({
          where: {
            billingStart: { lte: monthEndUtc },
            billingEnd: { gte: monthStartUtc },
            OR: [
              { companyId: company.id },
              { companyId: null, client: { brand: { companyId: company.id } } },
            ],
          },
          select: {
            invoiceNumber: true,
            invoiceType: true,
            billingStart: true,
            billingEnd: true,
            totalMWh: true,
            totalAmount: true,
            f1InvoiceId: true,
          },
        }),
        prisma.internalInvoice.findMany({
          where: {
            status: { in: ['EMITIDA', 'ABONO'] },
            hidden: false,
            billingStart: { lte: monthEndUtc },
            billingEnd: { gte: monthStartUtc },
            OR: [
              { companyId: company.id },
              { companyId: null, client: { brand: { companyId: company.id } } },
            ],
          },
          select: {
            invoiceNumber: true,
            invoiceType: true,
            status: true,
            billingStart: true,
            billingEnd: true,
            totalMWh: true,
            totalAmount: true,
            f1InvoiceId: true,
          },
        }),
        prisma.f1Invoice.findMany({
          where: {
            tipoDocumento: 'FacturaATR',
            fechaInicio: { lte: monthEndUtc },
            fechaFin: { gte: monthStartUtc },
            invoices: { none: {} },
            internalInvoices: { none: { status: { in: ['EMITIDA', 'ABONO'] }, hidden: false } },
            supplyPoint: { client: { brand: { companyId: company.id } } },
          },
          select: {
            fechaInicio: true,
            fechaFin: true,
            jsonData: true,
          },
        }),
      ]);

      const billedF1Ids = new Set<string>();
      const billedInvoiceNumbers = new Set<string>();
      let totalInvoicedMwh = 0;

      for (const inv of invoices) {
        if (inv.f1InvoiceId) billedF1Ids.add(inv.f1InvoiceId);
        if (inv.invoiceNumber) billedInvoiceNumbers.add(inv.invoiceNumber);
        if (!inv.billingStart || !inv.billingEnd) continue;

        let rawMwh = (inv.totalMWh || 0) / 1000;
        const typeLower = (inv.invoiceType || '').toLowerCase();
        if (typeLower.includes('abono') || ((inv.totalAmount ?? 0) < 0 && rawMwh > 0)) {
          rawMwh = -Math.abs(rawMwh);
        }
        // Si es Regularizadora o Rectificativa con totalMWh < 0, conserva su signo negativo natural
        totalInvoicedMwh += prorateEnergyForMonth(
          inv.billingStart,
          inv.billingEnd,
          monthStartUtc,
          monthEndDateOnlyUtc,
          rawMwh
        );
      }

      let internalInvoicedMwh = 0;
      for (const iInv of internalInvoices) {
        if (iInv.f1InvoiceId && billedF1Ids.has(iInv.f1InvoiceId)) continue;
        if (iInv.invoiceNumber && billedInvoiceNumbers.has(iInv.invoiceNumber)) continue;
        if (!iInv.billingStart || !iInv.billingEnd) continue;

        // En InternalInvoice, totalMWh ya está expresado en MWh
        let rawMwh = iInv.totalMWh || 0;
        const typeLower = (iInv.invoiceType || '').toLowerCase();
        if (iInv.status === 'ABONO' || typeLower.includes('abono') || ((iInv.totalAmount ?? 0) < 0 && rawMwh > 0)) {
          rawMwh = -Math.abs(rawMwh);
        }
        const prorated = prorateEnergyForMonth(
          iInv.billingStart,
          iInv.billingEnd,
          monthStartUtc,
          monthEndDateOnlyUtc,
          rawMwh
        );
        internalInvoicedMwh += prorated;
        totalInvoicedMwh += prorated;
      }

      let f1UnbilledMwh = 0;
      for (const f1 of unbilledF1s) {
        if (!f1.fechaInicio || !f1.fechaFin) continue;
        const kwh = extractF1ActiveEnergyKwh(f1.jsonData);
        if (kwh === 0) continue;
        f1UnbilledMwh += prorateEnergyForMonth(
          f1.fechaInicio,
          f1.fechaFin,
          monthStartUtc,
          monthEndDateOnlyUtc,
          kwh / 1000
        );
      }

      // 2. Cargar y fusionar REGANECU matricial (H + QH) por cierre usando mergeDailyReganecuRecords
      const rawReganecu = await prisma.reganecuData.findMany({
        where: {
          date: { gte: monthStartUtc, lte: monthEndUtc },
          matricial: true,
          region: 'peninsula',
          resolution: { in: ['H', 'QH'] },
          companyId: company.id,
        },
        orderBy: { date: 'asc' },
      });

      const rawByCierre = new Map<string, any[]>();
      for (const r of rawReganecu) {
        const cKey = r.cierre.trim().toUpperCase();
        if (!rawByCierre.has(cKey)) rawByCierre.set(cKey, []);
        rawByCierre.get(cKey)!.push(r);
      }

      type DayRegParsed = {
        cierre: string;
        rank: number;
        cadMwhByPeriod: Record<number, number>;
        cadCostByPeriod: Record<number, number>;
        pc3MwhByPeriod: Record<number, number>;
        pc3CostByPeriod: Record<number, number>;
        dsvByPeriod: Record<number, { eV: number; cD: number; eC: number; cO: number }>;
      };

      const bestDayReg = new Map<string, DayRegParsed>();
      const closureHistory: Array<{
        cierre: string;
        rank: number;
        days: number;
        liquidatedMwh: number;
        cadCostEur: number;
      }> = [];

      const sortedClosures = Array.from(rawByCierre.keys()).sort((a, b) => getCierreRank(a) - getCierreRank(b));

      for (const cierre of sortedClosures) {
        const mergedDays = mergeDailyReganecuRecords(rawByCierre.get(cierre)!, true);
        const rank = getCierreRank(cierre);
        let closureCadMwh = 0;
        let closureCadCost = 0;
        let closureDaysWithCad = 0;

        for (const dayRec of mergedDays) {
          const dayKey = dayRec.date.toISOString().slice(0, 10);
          const jData = dayRec.jsonData as any[];
          if (!Array.isArray(jData)) continue;

          const cadMwhByPeriod: Record<number, number> = {};
          const cadCostByPeriod: Record<number, number> = {};
          const pc3MwhByPeriod: Record<number, number> = {};
          const pc3CostByPeriod: Record<number, number> = {};
          const dsvByPeriod: Record<number, { eV: number; cD: number; eC: number; cO: number }> = {};

          let dayHasCad = false;

          for (const item of jData) {
            const rawPeriod = Number(item.period) || 0;
            // En mergeDailyReganecuRecords: CAD y PC3 vienen de H (periodos 1..24),
            // mientras que DSV viene de QH si existe qhRec (periodos 1..96) o de H si solo existe hRec (1..24).
            if (item.concept === 'CAD') {
              const p = rawPeriod > 24 ? Math.floor((rawPeriod - 1) / 4) + 1 : rawPeriod;
              if (p >= 1 && p <= 24) {
                const e = (item.energyVentas || 0) + (item.energyCompras || 0);
                const c = (item.costObligaciones || 0) - (item.costDerechos || 0);
                cadMwhByPeriod[p] = (cadMwhByPeriod[p] || 0) + e;
                cadCostByPeriod[p] = (cadCostByPeriod[p] || 0) + c;
                closureCadMwh += e;
                closureCadCost += c;
                if (e > 0) dayHasCad = true;
              }
            } else if (item.concept === 'PC3') {
              const p = rawPeriod > 24 ? Math.floor((rawPeriod - 1) / 4) + 1 : rawPeriod;
              if (p >= 1 && p <= 24) {
                const e = (item.energyVentas || 0) + (item.energyCompras || 0);
                const c = (item.costObligaciones || 0) - (item.costDerechos || 0);
                pc3MwhByPeriod[p] = (pc3MwhByPeriod[p] || 0) + e;
                pc3CostByPeriod[p] = (pc3CostByPeriod[p] || 0) + c;
              }
            } else if (item.concept === 'DSV' || item.concept === 'DVS') {
              const isFromQh = dayRec.resolution === 'QH';
              const p = isFromQh ? Math.floor((rawPeriod - 1) / 4) + 1 : rawPeriod;
              if (p >= 1 && p <= 24) {
                if (!dsvByPeriod[p]) dsvByPeriod[p] = { eV: 0, cD: 0, eC: 0, cO: 0 };
                dsvByPeriod[p].eV += item.energyVentas || 0;
                dsvByPeriod[p].cD += item.costDerechos || 0;
                dsvByPeriod[p].eC += item.energyCompras || 0;
                dsvByPeriod[p].cO += item.costObligaciones || 0;
              }
            }
          }

          if (dayHasCad) closureDaysWithCad++;

          const existingDay = bestDayReg.get(dayKey);
          if (!existingDay || rank >= existingDay.rank) {
            bestDayReg.set(dayKey, {
              cierre,
              rank,
              cadMwhByPeriod,
              cadCostByPeriod,
              pc3MwhByPeriod,
              pc3CostByPeriod,
              dsvByPeriod,
            });
          }
        }

        closureHistory.push({
          cierre,
          rank,
          days: closureDaysWithCad || mergedDays.length,
          liquidatedMwh: Number(closureCadMwh.toFixed(3)),
          cadCostEur: Number(closureCadCost.toFixed(2)),
        });
      }

      const reganecuDays = bestDayReg.size;
      let cierreLabel = 'N/A';
      if (reganecuDays > 0) {
        const closuresUsed = new Map<string, number>();
        for (const dReg of bestDayReg.values()) {
          closuresUsed.set(dReg.cierre, (closuresUsed.get(dReg.cierre) || 0) + 1);
        }
        const sortedUsed = Array.from(closuresUsed.entries()).sort(
          (a, b) => getCierreRank(b[0]) - getCierreRank(a[0])
        );
        if (sortedUsed.length === 1) {
          cierreLabel = sortedUsed[0][0];
        } else {
          // Ej. C1 (15 días) + A1 (16 días) -> "C1/A1"
          cierreLabel = sortedUsed.map(x => x[0]).join('/');
        }
      }

      // Calcular medias mensuales de respaldo sobre los registros diarios elegidos (sin duplicar H + QH)
      let totalECompras = 0;
      let totalCOblig = 0;
      let totalEVentas = 0;
      let totalCDerechos = 0;
      let totalMonthCadMwh = 0;
      let totalMonthCadCost = 0;

      for (const dReg of bestDayReg.values()) {
        for (const dsv of Object.values(dReg.dsvByPeriod)) {
          totalEVentas += dsv.eV;
          totalCDerechos += dsv.cD;
          totalECompras += dsv.eC;
          totalCOblig += dsv.cO;
        }
        for (const pStr of Object.keys(dReg.cadMwhByPeriod)) {
          const p = Number(pStr);
          totalMonthCadMwh += dReg.cadMwhByPeriod[p] || 0;
          totalMonthCadCost += dReg.cadCostByPeriod[p] || 0;
        }
      }

      const omieStat = rawPricesByMonthComp.get(`${monthKey}_OMIE`);
      const resStat = rawPricesByMonthComp.get(`${monthKey}_RESTRICCIONES`);
      const osStat = rawPricesByMonthComp.get(`${monthKey}_OS`);

      const omieMonthlyAvg = omieStat && omieStat.dayCount > 0 ? omieStat.sumDailyAvg / omieStat.dayCount : null;
      const resMonthlyAvg = resStat && resStat.dayCount > 0 ? resStat.sumDailyAvg / resStat.dayCount : null;
      const osMonthlyAvg = osStat && osStat.dayCount > 0 ? osStat.sumDailyAvg / osStat.dayCount : null;
      const reganecuCadUnitAvg = totalMonthCadMwh > 0.1 ? totalMonthCadCost / totalMonthCadMwh : null;

      let defaultPriceSubir =
        totalECompras > 0.1 ? totalCOblig / totalECompras : (omieMonthlyAvg ?? 75);
      let defaultPriceBajar =
        totalEVentas > 0.1 ? totalCDerechos / totalEVentas : (omieMonthlyAvg ?? defaultPriceSubir);

      if (defaultPriceBajar > defaultPriceSubir && defaultPriceSubir > 0) {
        defaultPriceBajar = defaultPriceSubir;
      }
      if (defaultPriceSubir > 500) defaultPriceSubir = omieMonthlyAvg ?? 100;
      if (defaultPriceBajar > 500) defaultPriceBajar = omieMonthlyAvg ?? 100;

      // 3. Recorrido horario completo de todos los días del mes (1..daysInMonth), haya o no CCH ese día
      let totalRawCchMwh = 0;
      let totalSurplusMwh = 0;
      let totalEstimatedBcMwh = 0;
      let totalLiquidatedMwh = 0;
      let totalPendingMwh = 0;
      let totalEstimatedPendingCostEur = 0;
      let cchDays = 0;

      let weightedMarketNumerator = 0;
      let weightedMarketDenominator = 0;
      const tariffBreakdown: Record<string, { rawMwh: number; bcMwh: number }> = {};

      for (let d = 1; d <= daysInMonth; d++) {
        const dayUtc = new Date(Date.UTC(yearNum, monthNum - 1, d, 0, 0, 0, 0));
        const dayKey = dayUtc.toISOString().slice(0, 10);

        const dayTariffCurves = dailyCurvesByTariff.get(dayKey);
        const dayReg = bestDayReg.get(dayKey);

        const omie24 = pricesByDateComponent.get(`${dayKey}_OMIE`);
        const os24 = pricesByDateComponent.get(`${dayKey}_OS`) || new Array(24).fill(0);
        const restricciones24 = pricesByDateComponent.get(`${dayKey}_RESTRICCIONES`) || new Array(24).fill(0);
        const k24 = pricesByDateComponent.get(`${dayKey}_K`) || new Array(24).fill(1);
        const perd20Legacy = pricesByDateComponent.get(`${dayKey}_PERD_20TD`);
        const perd30Legacy = pricesByDateComponent.get(`${dayKey}_PERD_30TD`);
        const perd30VeLegacy = pricesByDateComponent.get(`${dayKey}_PERD_30TDVE`);
        const perd61Legacy = pricesByDateComponent.get(`${dayKey}_PERD_61TD`);

        let dayRawMwhSum = 0;

        for (let h = 0; h < 24; h++) {
          let hBcMwh = 0;
          let hRawMwh = 0;
          let hWeightedBoePcEurMwh = 0;

          if (dayTariffCurves) {
            for (const [tariff, bucket] of Object.entries(dayTariffCurves)) {
              const kwhCons = bucket.consumption[h] || 0;
              const kwhSurp = bucket.surplus[h] || 0;
              if (kwhCons === 0 && kwhSurp === 0) continue;

              const periodStr = getCachedMadridPeriod(dayKey, h, tariff); // 'P1'..'P6'
              const pKey = periodStr.toLowerCase() as 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6';

              // Resolver % de pérdidas BOE * Factor K cuartohorario promediado en la hora h
              const boeLossRow = resolveBoeRow('PERDIDAS', tariff, dayUtc);
              const basePct = boeLossRow ? normalizeBoeLossPct(boeLossRow[pKey] as number | null) : null;

              let lossPct = 0;
              if (basePct !== null) {
                lossPct = basePct * (k24[h] ?? 1);
              } else {
                const legArr =
                  tariff === '3.0TDVE'
                    ? perd30VeLegacy || perd30Legacy
                    : tariff === '3.0TD'
                      ? perd30Legacy
                      : tariff.startsWith('6.')
                        ? perd61Legacy
                        : perd20Legacy;
                const legVal = legArr ? legArr[h] || 0 : 0;
                lossPct = Math.abs(legVal) > 1.0 ? legVal / 100 : legVal;
              }

              const consMwh = kwhCons / 1000;
              const surpMwh = kwhSurp / 1000;
              const bcConsMwh = consMwh * (1 + lossPct);
              // Según P.O. 14.8, el excedente horario neto vertido minora adquisición a 1.0x (sin pérdidas)
              const netTariffBcMwh = bcConsMwh - surpMwh;

              hRawMwh += consMwh;
              dayRawMwhSum += consMwh;
              totalRawCchMwh += consMwh;
              totalSurplusMwh += surpMwh;
              hBcMwh += netTariffBcMwh;

              if (!tariffBreakdown[tariff]) {
                tariffBreakdown[tariff] = { rawMwh: 0, bcMwh: 0 };
              }
              tariffBreakdown[tariff].rawMwh += consMwh;
              tariffBreakdown[tariff].bcMwh += netTariffBcMwh;

              // Pagos por capacidad BOE de respaldo (en €/kWh -> *1000 a €/MWh)
              const boePcRow = resolveBoeRow('Pagos_Capacidad', tariff, dayUtc);
              const pcKwh = boePcRow ? Number(boePcRow[pKey] || 0) : 0;
              hWeightedBoePcEurMwh += consMwh * (pcKwh * 1000);
            }
          }

          const period = h + 1;
          const hLiquidatedMwh = dayReg ? dayReg.cadMwhByPeriod[period] || 0 : 0;

          totalEstimatedBcMwh += hBcMwh;
          totalLiquidatedMwh += hLiquidatedMwh;

          const hOmie = omie24 ? omie24[h] : undefined;
          if (hBcMwh > 0 && hOmie !== undefined) {
            const hCadComp = (restricciones24[h] || 0) + (os24[h] || 0);
            weightedMarketNumerator += hBcMwh * (hOmie + hCadComp);
            weightedMarketDenominator += hBcMwh;
          }

          if (reganecuDays > 0) {
            const hPendingMwh = hBcMwh - hLiquidatedMwh;
            const dsv = dayReg?.dsvByPeriod[period];

            const obsSubir = dsv && dsv.eC > 0.005 ? dsv.cO / dsv.eC : null;
            const obsBajar = dsv && dsv.eV > 0.005 ? dsv.cD / dsv.eV : null;

            let pSubir: number;
            if (obsSubir !== null) {
              pSubir = obsSubir;
            } else if (obsBajar !== null) {
              pSubir = hOmie !== undefined ? Math.max(obsBajar, hOmie) : obsBajar;
            } else {
              pSubir = hOmie ?? defaultPriceSubir;
            }

            let pBajar: number;
            if (obsBajar !== null) {
              pBajar = obsBajar;
            } else if (obsSubir !== null) {
              pBajar = hOmie !== undefined ? Math.min(obsSubir, hOmie) : obsSubir;
            } else {
              pBajar = hOmie ?? defaultPriceBajar;
            }

            if (pBajar > pSubir && pSubir > 0) pBajar = pSubir;
            if (pSubir > 1500 || pSubir < -500) pSubir = hOmie ?? defaultPriceSubir;
            if (pBajar > 1500 || pBajar < -500) pBajar = hOmie ?? defaultPriceBajar;

            const hDsvPrice = hPendingMwh >= 0 ? pSubir : pBajar;

            // Coste unitario horario de CAD (OS + Restricciones) y PC3 (Pagos por Capacidad)
            const regCadMwh = dayReg?.cadMwhByPeriod[period] || 0;
            const regCadCost = dayReg?.cadCostByPeriod[period] || 0;
            const hCadUnit =
              regCadMwh > 0.01
                ? regCadCost / regCadMwh
                : reganecuCadUnitAvg !== null && !resStat?.dayCount && !osStat?.dayCount
                  ? reganecuCadUnitAvg
                  : (os24[h] || 0) + (restricciones24[h] || 0);

            const regPc3Mwh = dayReg?.pc3MwhByPeriod[period] || 0;
            const regPc3Cost = dayReg?.pc3CostByPeriod[period] || 0;
            const fallbackBoePc = hRawMwh > 0 ? hWeightedBoePcEurMwh / hRawMwh : 0;
            const hPc3Unit = regPc3Mwh > 0.01 ? regPc3Cost / regPc3Mwh : fallbackBoePc;

            const hPrice = hDsvPrice + hCadUnit + hPc3Unit;
            totalPendingMwh += hPendingMwh;
            totalEstimatedPendingCostEur += hPendingMwh * hPrice;
          }
        }

        if (dayRawMwhSum > 0) {
          cchDays++;
        }
      }

      // 4. Precio de mercado mensual para valorar el Descuadre F1-CCH (OMIE medio + Restricciones medias)
      let priceFallbackUsed = false;
      const effectiveOmieAvg = omieMonthlyAvg !== null ? omieMonthlyAvg : ((priceFallbackUsed = true), 60);
      let effectiveResAvg: number;
      let resSource: 'COMPODEM' | 'REGANECU_CAD' | 'FALLBACK' = 'COMPODEM';

      if (resMonthlyAvg !== null) {
        effectiveResAvg = resMonthlyAvg;
      } else if (reganecuCadUnitAvg !== null) {
        effectiveResAvg = reganecuCadUnitAvg;
        resSource = 'REGANECU_CAD';
      } else {
        effectiveResAvg = 15;
        resSource = 'FALLBACK';
        priceFallbackUsed = true;
      }

      const marketPrice = effectiveOmieAvg + effectiveResAvg;
      const weightedMarketPrice =
        weightedMarketDenominator > 0 ? weightedMarketNumerator / weightedMarketDenominator : marketPrice;
      const grossBcConsMwh = totalEstimatedBcMwh + totalSurplusMwh;
      const lossRatio =
        totalRawCchMwh > 0 && grossBcConsMwh > 0 ? grossBcConsMwh / totalRawCchMwh : 1.15;

      const details = {
        lossRatio: Number(lossRatio.toFixed(5)),
        omieAvg: Number(effectiveOmieAvg.toFixed(2)),
        restriccionesAvg: Number(effectiveResAvg.toFixed(2)),
        osAvg: osMonthlyAvg !== null ? Number(osMonthlyAvg.toFixed(2)) : null,
        weightedMarketPrice: Number(weightedMarketPrice.toFixed(2)),
        resSource,
        priceFallbackUsed,
        internalInvoicedMwh: Number(internalInvoicedMwh.toFixed(3)),
        closureHistory,
        tariffBreakdown: Object.fromEntries(
          Object.entries(tariffBreakdown).map(([k, v]) => [
            k,
            { rawMwh: Number(v.rawMwh.toFixed(3)), bcMwh: Number(v.bcMwh.toFixed(3)) },
          ])
        ),
      };

      await prisma.pendingEnergySummary.upsert({
        where: {
          month_companyId: {
            month: monthKey,
            companyId: company.id,
          },
        },
        update: {
          cierre: cierreLabel,
          estimatedBcMwh: totalEstimatedBcMwh,
          liquidatedMwh: totalLiquidatedMwh,
          pendingMwh: totalPendingMwh,
          estimatedPendingCostEur: totalEstimatedPendingCostEur,
          invoicedMwh: totalInvoicedMwh,
          rawCchMwh: totalRawCchMwh,
          surplusMwh: totalSurplusMwh,
          f1UnbilledMwh,
          marketPrice,
          cchDays,
          reganecuDays,
          daysInMonth,
          details,
        },
        create: {
          month: monthKey,
          companyId: company.id,
          cierre: cierreLabel,
          estimatedBcMwh: totalEstimatedBcMwh,
          liquidatedMwh: totalLiquidatedMwh,
          pendingMwh: totalPendingMwh,
          estimatedPendingCostEur: totalEstimatedPendingCostEur,
          invoicedMwh: totalInvoicedMwh,
          rawCchMwh: totalRawCchMwh,
          surplusMwh: totalSurplusMwh,
          f1UnbilledMwh,
          marketPrice,
          cchDays,
          reganecuDays,
          daysInMonth,
          details,
        },
      });

      const msg = `✅ Mes ${monthKey} procesado (${cierreLabel}). CCH: ${cchDays}/${daysInMonth}d | Pte CCH: ${totalPendingMwh.toFixed(2)} MWh`;
      console.log(msg);
      if (onProgress) onProgress(msg);
    }
  }

  console.log('Cálculo finalizado exitosamente.');
  if (onProgress) onProgress('Cálculo finalizado exitosamente.');
}

if (require.main === module) {
  runCalculatePendingEnergy()
    .catch(e => {
      console.error('Error calculando:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
