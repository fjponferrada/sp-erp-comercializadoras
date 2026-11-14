import { prisma } from '../prisma';
import { fromZonedTime } from 'date-fns-tz';

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
  cchStartDate?: string; // YYYY-MM-DD opcional para alinear estacionalmente la CCH con startDate
  startDate: string; // YYYY-MM-DD
  durationMonths: number;
  riskLevel: number;
  companyId?: string | null;
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
  flatCostEurMwh: number;
  totalConsumptionKwh: number;
  periods: Record<string, { priceEurMwh: number; percentage: number; costEurMwh: number; consumptionKwh: number }>;
  breakdown: {
    energyCostEur: number;
    lossesCostEur: number;
    regulatedCostEur: number;
    marginEur: number;
    municipalTaxEur: number;
    totalEur: number;
  };
  hourlyDetails: HourlyDetail[];
}

// Festivos nacionales de fecha fija no sustituibles + 6 de enero según Circular 3/2020 de la CNMC (art. 7)
export const CNMC_FIXED_NATIONAL_HOLIDAYS = new Set([
  '01-01', // Año Nuevo
  '01-06', // Epifanía del Señor (Reyes)
  '05-01', // Fiesta del Trabajo
  '08-15', // Asunción de la Virgen
  '10-12', // Fiesta Nacional de España
  '11-01', // Todos los Santos
  '12-06', // Día de la Constitución Española
  '12-08', // Inmaculada Concepción
  '12-25', // Natividad del Señor
]);

// 14 componentes horarios de Servicios de Ajuste (COMPODEM REE / Regla 128)
export const COMPODEM_COMPONENTS = [
  'RT3', 'RT6', 'CT2', 'CT3', 'BS3', 'RAD3', 'RAD1',
  'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP', 'MI', 'SECX',
] as const;

interface MadridParts {
  year: number;
  month: number; // 1..12
  day: number;   // 1..31
  hour: number;  // 0..23
  dow: number;   // 0=Sun..6=Sat
  mmdd: string;  // MM-DD
  localIso: string; // YYYY-MM-DD HH:00
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function getMadridParts(utcMs: number): MadridParts {
  const approxYear = new Date(utcMs + 7200000).getUTCFullYear();
  const mar31Dow = new Date(Date.UTC(approxYear, 2, 31)).getUTCDay();
  const dstStartUtc = Date.UTC(approxYear, 2, 31 - mar31Dow, 1, 0, 0);
  const oct31Dow = new Date(Date.UTC(approxYear, 9, 31)).getUTCDay();
  const dstEndUtc = Date.UTC(approxYear, 9, 31 - oct31Dow, 1, 0, 0);
  const offsetMs = (utcMs >= dstStartUtc && utcMs < dstEndUtc) ? 7200000 : 3600000;
  const local = new Date(utcMs + offsetMs);

  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const hour = local.getUTCHours();
  const dow = local.getUTCDay();
  const mm = pad2(month);
  const dd = pad2(day);

  return {
    year,
    month,
    day,
    hour,
    dow,
    mmdd: `${mm}-${dd}`,
    localIso: `${year}-${mm}-${dd} ${pad2(hour)}:00`,
  };
}

function getPeriodoFromParts(
  month: number,
  day: number,
  hour: number,
  dow: number,
  tariff: string,
  extraHoliday: boolean = false
): string {
  const mmdd = `${pad2(month)}-${pad2(day)}`;
  const isWeekend = dow === 0 || dow === 6;
  const isHol = extraHoliday || isWeekend || CNMC_FIXED_NATIONAL_HOLIDAYS.has(mmdd);

  if (tariff === '2.0TD' || tariff.includes('2.0')) {
    if (isHol || (hour >= 0 && hour < 8)) return 'P3';
    if (hour === 8 || hour === 9 || (hour >= 14 && hour <= 17) || hour === 22 || hour === 23) return 'P2';
    return 'P1';
  }

  if (isHol || (hour >= 0 && hour < 8)) return 'P6';
  const isPeakWindow = (hour >= 9 && hour < 14) || (hour >= 18 && hour < 22);
  if (month === 1 || month === 2 || month === 7 || month === 12) return isPeakWindow ? 'P1' : 'P2';
  if (month === 3 || month === 11) return isPeakWindow ? 'P2' : 'P3';
  if (month === 4 || month === 5 || month === 10) return isPeakWindow ? 'P4' : 'P5';
  if (month === 6 || month === 8 || month === 9) return isPeakWindow ? 'P3' : 'P4';

  return 'P6';
}

async function smartMergeBatchDB(
  madridDates: MadridParts[],
  compNames: string[],
  risk: number
): Promise<Record<string, number[]>> {
  const nowYear = new Date().getUTCFullYear();
  const minHistDate = new Date(Date.UTC(nowYear - 3, 0, 1, 0, 0, 0));

  const rows = await prisma.systemComponentPrice.findMany({
    where: {
      component: { in: compNames },
      date: { gte: minHistDate },
    },
    select: {
      component: true,
      date: true,
      values: true,
    },
  });

  // Agrupación por componente -> `${m}-${w}-${h}` -> year -> { sum, count }
  // y fallback mensual por componente -> `${m}-${h}` -> year -> { sum, count }
  const byDow = new Map<string, Map<number, { sum: number; count: number }>>();
  const byMonth = new Map<string, Map<number, { sum: number; count: number }>>();

  for (const row of rows) {
    const comp = row.component;
    const isK = comp === 'K';
    const y = row.date.getUTCFullYear();
    const m = row.date.getUTCMonth() + 1;
    const w = row.date.getUTCDay();
    const vals = row.values;
    const isQuarterly = vals.length >= 92;

    for (let h = 0; h < 24; h++) {
      let val: number | null = null;
      if (isQuarterly) {
        const baseIdx = h * 4;
        if (baseIdx < vals.length) {
          let qSum = 0;
          let qCnt = 0;
          for (let q = 0; q < 4; q++) {
            const v = vals[baseIdx + q];
            if (v !== undefined && v !== null && !Number.isNaN(v)) {
              qSum += v;
              qCnt++;
            }
          }
          if (qCnt > 0) val = qSum / qCnt;
        }
      } else if (h < vals.length) {
        const v = vals[h];
        if (v !== undefined && v !== null && !Number.isNaN(v)) {
          val = v;
        }
      }

      if (val === null) continue;
      // Para K (multiplicador ~1.0) descartamos ceros corruptos; para SSAA 0.0 €/MWh es un dato real válido
      if (isK && val <= 0) continue;

      const dowKey = `${comp}|${m}-${w}-${h}`;
      let yearMap = byDow.get(dowKey);
      if (!yearMap) {
        yearMap = new Map();
        byDow.set(dowKey, yearMap);
      }
      const prevDow = yearMap.get(y);
      if (prevDow) {
        prevDow.sum += val;
        prevDow.count += 1;
      } else {
        yearMap.set(y, { sum: val, count: 1 });
      }

      const monthKey = `${comp}|${m}-${h}`;
      let mYearMap = byMonth.get(monthKey);
      if (!mYearMap) {
        mYearMap = new Map();
        byMonth.set(monthKey, mYearMap);
      }
      const prevM = mYearMap.get(y);
      if (prevM) {
        prevM.sum += val;
        prevM.count += 1;
      } else {
        mYearMap.set(y, { sum: val, count: 1 });
      }
    }
  }

  // Pre-resolver el valor de riesgo para cada clave única `(comp, m, w, h)`
  const resolvedCache = new Map<string, number>();

  const resolveForPattern = (comp: string, m: number, w: number, h: number): number => {
    const cacheKey = `${comp}|${m}-${w}-${h}`;
    const cached = resolvedCache.get(cacheKey);
    if (cached !== undefined) return cached;

    let yearMap = byDow.get(cacheKey);
    if (!yearMap || yearMap.size === 0) {
      yearMap = byMonth.get(`${comp}|${m}-${h}`);
    }

    if (!yearMap || yearMap.size === 0) {
      const fallback = comp === 'K' ? 1.0 : 0.0;
      resolvedCache.set(cacheKey, fallback);
      return fallback;
    }

    // Tomar los 2 años históricos más recientes con datos reales (T-1 y T-2 efectivos)
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b - a).slice(0, 2);
    const validVals = sortedYears.map(yr => {
      const entry = yearMap!.get(yr)!;
      return entry.sum / entry.count;
    });

    let chosen: number;
    if (risk === 1) chosen = Math.max(...validVals);
    else if (risk === 3) chosen = Math.min(...validVals);
    else chosen = validVals.reduce((a, b) => a + b, 0) / validVals.length;

    resolvedCache.set(cacheKey, chosen);
    return chosen;
  };

  const result: Record<string, number[]> = {};
  for (const comp of compNames) {
    const arr = new Array<number>(madridDates.length);
    for (let i = 0; i < madridDates.length; i++) {
      const mp = madridDates[i];
      arr[i] = resolveForPattern(comp, mp.month, mp.dow, mp.hour);
    }
    result[comp] = arr;
  }

  return result;
}

export class PricingEngine {
  static getPeriodo(dt: Date, tariff: string, isHoliday: boolean = false): string {
    const mp = getMadridParts(dt.getTime());
    return getPeriodoFromParts(mp.month, mp.day, mp.hour, mp.dow, tariff, isHoliday);
  }

  static async generateQuote(params: PricingParams): Promise<QuoteResult> {
    const tariff = params.tariff.trim().replace(/\s+/g, '').toUpperCase();
    const {
      margin,
      deviations,
      startDate,
      sipsData,
      cchData,
      cchStartDate,
      annualConsumptionKwh,
      durationMonths = 12,
      riskLevel = 2,
      companyId,
    } = params;

    // 1. Construir horizonte horario exacto en hora oficial de España (Europe/Madrid)
    const [startY, startM, startD] = startDate.split('-').map(Number);
    if (!startY || !startM || !startD) {
      throw new Error(`Fecha de inicio inválida: ${startDate}`);
    }

    const endCal = new Date(Date.UTC(startY, startM - 1 + durationMonths, 1));
    const maxDayInEndMonth = new Date(Date.UTC(endCal.getUTCFullYear(), endCal.getUTCMonth() + 1, 0)).getUTCDate();
    const endDay = Math.min(startD, maxDayInEndMonth);
    const endDateStr = `${endCal.getUTCFullYear()}-${pad2(endCal.getUTCMonth() + 1)}-${pad2(endDay)}`;

    const start = fromZonedTime(`${startDate}T00:00:00`, 'Europe/Madrid');
    const end = fromZonedTime(`${endDateStr}T00:00:00`, 'Europe/Madrid');

    const totalHours = Math.round((end.getTime() - start.getTime()) / 3600000);
    if (totalHours <= 0) {
      throw new Error('El periodo de cotización debe contener al menos 1 hora.');
    }

    const dates: Date[] = new Array(totalHours);
    const madridDates: MadridParts[] = new Array(totalHours);
    const startMs = start.getTime();

    for (let i = 0; i < totalHours; i++) {
      const utcMs = startMs + i * 3600000;
      dates[i] = new Date(utcMs);
      madridDates[i] = getMadridParts(utcMs);
    }

    // Normalización preventiva de curva CCH si viniera cuarto-horaria (ej. 35.040 registros)
    let normalizedCch: number[] | undefined = undefined;
    if (cchData && cchData.length > 0) {
      if (cchData.length >= 20000) {
        normalizedCch = [];
        for (let k = 0; k < cchData.length; k += 4) {
          normalizedCch.push(
            (cchData[k] || 0) +
            (cchData[k + 1] || 0) +
            (cchData[k + 2] || 0) +
            (cchData[k + 3] || 0)
          );
        }
      } else {
        normalizedCch = cchData;
      }
    }

    const hasCch = !!(normalizedCch && normalizedCch.length > 0);
    const isSips = !hasCch && !!sipsData;
    const totalAnnualInput = isSips
      ? Object.values(sipsData!).reduce((a, b) => a + (Number(b) || 0), 0)
      : (annualConsumptionKwh || 10000);

    // 2. Cargar Perfiles Iniciales REE (1..24 en BD -> 0..23 local España)
    const targetYear = startY;
    let perfilesUsar = await prisma.reeProfile.findMany({
      where: { year: targetYear },
    });

    if (perfilesUsar.length === 0) {
      const maxYearData = await prisma.reeProfile.findFirst({ orderBy: { year: 'desc' } });
      if (maxYearData) {
        perfilesUsar = await prisma.reeProfile.findMany({ where: { year: maxYearData.year } });
      }
    }

    const reeProfiles: Record<string, number> = {};
    if (perfilesUsar.length > 0) {
      const profileYear = perfilesUsar[0].year;
      const profileGroups: Record<string, number[]> = {};
      const is20 = tariff.includes('2.0');
      const isTdve = tariff.includes('TDVE');

      for (const r of perfilesUsar) {
        if (r.hour < 1 || r.hour > 24) continue; // Ignorar hora 25 de cambio horario de octubre
        const h0 = r.hour - 1; // Mapear hora española 1..24 -> 0..23
        const rawCoef = is20 ? r.p20td : (isTdve ? (r.p30tdve ?? r.p30td) : r.p30td);
        const coef = rawCoef || 0.0001;
        // Mediodía UTC evita cualquier desfase de día de la semana
        const w = new Date(Date.UTC(profileYear, r.month - 1, r.day, 12)).getUTCDay();
        const key = `${r.month}-${w}-${h0}`;
        if (!profileGroups[key]) profileGroups[key] = [];
        profileGroups[key].push(coef);
      }

      for (const [key, arr] of Object.entries(profileGroups)) {
        reeProfiles[key] = arr.reduce((a, b) => a + b, 0) / arr.length;
      }
    }

    // Suma teórica anual por periodo para perfilado SIPS
    const sumCoefByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 31; d++) {
        const dtCheck = new Date(Date.UTC(targetYear, m - 1, d, 12));
        if (dtCheck.getUTCMonth() + 1 !== m) continue;
        const w = dtCheck.getUTCDay();
        for (let h = 0; h < 24; h++) {
          const coef = reeProfiles[`${m}-${w}-${h}`] || 0.0001;
          const p = getPeriodoFromParts(m, d, h, w, tariff, false);
          sumCoefByPeriod[p] += coef;
        }
      }
    }

    // 3. Cargar Curva Base del Portfolio para el rango exacto [start, end) y comercializadora activa
    let portfolioBaseData = await prisma.portfolioBaseCurve.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        datetime: { gte: start, lt: end },
      },
      select: { datetime: true, basePriceEurMwh: true },
    });

    if (portfolioBaseData.length === 0 && companyId) {
      portfolioBaseData = await prisma.portfolioBaseCurve.findMany({
        where: { companyId: null, datetime: { gte: start, lt: end } },
        select: { datetime: true, basePriceEurMwh: true },
      });
    }

    if (portfolioBaseData.length === 0) {
      throw new Error(
        '[CRÍTICO] La tabla PortfolioBaseCurve está vacía para el periodo seleccionado. Haz clic en "Sincronizar Portfolio Ahora" en la barra superior para regenerar la curva.'
      );
    }

    const portfolioByHourEpoch = new Map<number, number>();
    for (const c of portfolioBaseData) {
      portfolioByHourEpoch.set(Math.floor(c.datetime.getTime() / 3600000), c.basePriceEurMwh);
    }

    // 4. Cargar Costes Regulados vigentes en el rango (con fallback al último año cargado si se cotiza más allá de validTo)
    let regulatedAll = await prisma.regulatedCost.findMany({
      where: {
        OR: [{ tariff }, { tariff: 'TODAS' }],
        validFrom: { lte: end },
        validTo: { gte: start },
      },
      orderBy: { validFrom: 'desc' },
    });

    if (regulatedAll.length === 0) {
      regulatedAll = await prisma.regulatedCost.findMany({
        where: { OR: [{ tariff }, { tariff: 'TODAS' }] },
        orderBy: { validFrom: 'desc' },
      });
    }

    // Agrupar por concepto+tarifa quedándonos con el registro vigente para una fecha dada (o el más reciente)
    const selectActiveRegulatedForTime = (utcMs: number) => {
      const byConcept = new Map<string, (typeof regulatedAll)[number]>();
      for (const reg of regulatedAll) {
        const key = `${reg.concept.toUpperCase()}|${reg.tariff.toUpperCase()}`;
        const fromMs = reg.validFrom.getTime();
        const toMs = reg.validTo ? reg.validTo.getTime() : Number.MAX_SAFE_INTEGER;
        if (utcMs >= fromMs && utcMs <= toMs) {
          if (!byConcept.has(key)) byConcept.set(key, reg);
        }
      }
      // Completar conceptos que no tuvieran cobertura exacta en utcMs con el más reciente disponible
      for (const reg of regulatedAll) {
        const key = `${reg.concept.toUpperCase()}|${reg.tariff.toUpperCase()}`;
        if (!byConcept.has(key)) {
          byConcept.set(key, reg);
        }
      }
      return Array.from(byConcept.values());
    };

    // Pre-cachear costes regulados por mes del horizonte (evita iterar 26.280 veces sobre Prisma rows)
    const regulatedCacheByYearMonth = new Map<number, typeof regulatedAll>();

    // 5. Smart Merge en lote (1 sola consulta SQL para los 14 componentes COMPODEM + K)
    const mergedSeries = await smartMergeBatchDB(
      madridDates,
      [...COMPODEM_COMPONENTS, 'K'],
      riskLevel
    );
    const kArr = mergedSeries['K'];

    // 6. Normalización volumétrica en dos pasadas (escalando también SIPS y Estimado a la duración real del contrato)
    const durationScale = totalHours / 8760;
    const rawHourlyKwh = new Array<number>(totalHours);
    const hourPeriods = new Array<string>(totalHours);
    const rawSumByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    let sumRawKwh = 0;

    // Calcular desplazamiento horario estacional si la CCH trae fecha de inicio conocida
    let cchHourOffset = 0;
    if (hasCch && normalizedCch && normalizedCch.length >= 24 * 28 && cchStartDate) {
      const [cy, cm, cd] = cchStartDate.split('-').map(Number);
      if (cy && cm && cd) {
        const startDoy = Math.floor((Date.UTC(startY, startM - 1, startD) - Date.UTC(startY, 0, 1)) / 86400000);
        const cchDoy = Math.floor((Date.UTC(startY, cm - 1, cd) - Date.UTC(startY, 0, 1)) / 86400000);
        const rawDiffHours = (startDoy - cchDoy) * 24;
        cchHourOffset = ((rawDiffHours % normalizedCch.length) + normalizedCch.length) % normalizedCch.length;
      }
    }

    for (let j = 0; j < totalHours; j++) {
      const mp = madridDates[j];
      const p = getPeriodoFromParts(mp.month, mp.day, mp.hour, mp.dow, tariff, false);
      hourPeriods[j] = p;

      let v = 0;
      if (hasCch && normalizedCch) {
        v = normalizedCch[(j + cchHourOffset) % normalizedCch.length] || 0;
      } else if (isSips && sipsData) {
        const sipsPeriodKwh = Number((sipsData as any)[p.toLowerCase()] || 0);
        const coef = reeProfiles[`${mp.month}-${mp.dow}-${mp.hour}`] || 0.0001;
        const sumCoef = sumCoefByPeriod[p] || 1;
        v = (sipsPeriodKwh * coef) / sumCoef;
      } else {
        v = reeProfiles[`${mp.month}-${mp.dow}-${mp.hour}`] || (1 / 8760);
      }

      rawHourlyKwh[j] = v;
      rawSumByPeriod[p] += v;
      sumRawKwh += v;
    }

    const targetPeriodConsumption = totalAnnualInput * durationScale;

    // Verificar si en modo SIPS todos los periodos con consumo > 0 existen en la tarifa elegida
    let canNormalizeSipsPerPeriod = isSips && !!sipsData;
    if (canNormalizeSipsPerPeriod && sipsData) {
      for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
        const targetP = Number((sipsData as any)[p.toLowerCase()] || 0);
        if (targetP > 0 && rawSumByPeriod[p] <= 0) {
          canNormalizeSipsPerPeriod = false;
          break;
        }
      }
    }

    // 7. Simulación financiera hora a hora
    let totalEnergyCostEur = 0;
    let totalLossesCostEur = 0;
    let totalRegulatedCostEur = 0;
    let totalMarginEur = 0;
    let totalMunicipalTaxEur = 0;
    let totalPeriodKwh = 0;

    const periodsBreakdown: Record<string, {
      consumption: number;
      costAbs: number;
      energyAbs: number;
      lossAbs: number;
      regAbs: number;
    }> = {};
    for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
      periodsBreakdown[p] = { consumption: 0, costAbs: 0, energyAbs: 0, lossAbs: 0, regAbs: 0 };
    }

    const hourlyDetails: HourlyDetail[] = new Array(totalHours);
    const dsvVal = deviations !== undefined && deviations !== null ? deviations : 2.0;

    for (let i = 0; i < totalHours; i++) {
      const dt = dates[i];
      const mp = madridDates[i];
      const p = hourPeriods[i];
      const pLow = p.toLowerCase();

      let hourlyKwh = rawHourlyKwh[i];
      if (!hasCch) {
        if (canNormalizeSipsPerPeriod && sipsData) {
          const targetP = Number((sipsData as any)[pLow] || 0) * durationScale;
          hourlyKwh = rawSumByPeriod[p] > 0 ? (hourlyKwh / rawSumByPeriod[p]) * targetP : 0;
        } else if (sumRawKwh > 0) {
          hourlyKwh = (hourlyKwh / sumRawKwh) * targetPeriodConsumption;
        }
      }

      const hourEpoch = Math.floor(dt.getTime() / 3600000);
      const baseMercado = portfolioByHourEpoch.get(hourEpoch);

      if (baseMercado === undefined) {
        throw new Error(
          `[CRÍTICO] Faltan datos en la Curva Base del Portfolio para ${mp.localIso} (España). Haz clic en "Sincronizar Portfolio Ahora" en la barra superior para actualizar el horizonte de hasta 36 meses.`
        );
      }

      const ymKey = mp.year * 100 + mp.month;
      let activeRegulated = regulatedCacheByYearMonth.get(ymKey);
      if (!activeRegulated) {
        activeRegulated = selectActiveRegulatedForTime(dt.getTime());
        regulatedCacheByYearMonth.set(ymKey, activeRegulated);
      }

      const kFactor = kArr[i] || 1.0;

      let sumComps = 0;
      for (const c of COMPODEM_COMPONENTS) {
        sumComps += mergedSeries[c][i] || 0;
      }

      const boeRecord = activeRegulated.find(
        c => c.concept.toUpperCase() === 'PERDIDAS' && c.tariff.toUpperCase() === tariff
      );

      let lossPct = 0;
      if (boeRecord) {
        const pVal = boeRecord[pLow as keyof typeof boeRecord] as number | null;
        if (pVal !== null && pVal !== undefined) {
          // En RegulatedCost las pérdidas BOE se almacenan en % (ej. 16.7 en 2.0TD, 1.6 en 6.4TD)
          let baseLoss = Number(pVal);
          if (baseLoss > 0.5) baseLoss /= 100.0;
          lossPct = baseLoss * kFactor;
        }
      }
      const lossF = 1 + lossPct;

      let regLossAffected = 0;
      let regNonLossTaxable = 0;
      let regNonTaxableAtr = 0;

      for (const reg of activeRegulated) {
        const conceptLow = reg.concept.toLowerCase();
        if (conceptLow === 'perdidas') continue;
        if (
          conceptLow.includes('potencia') ||
          conceptLow.includes('fijo') ||
          conceptLow.includes('bono') ||
          conceptLow.includes('alquiler')
        ) {
          continue;
        }

        let val = 0;
        if (reg.singleValue !== null && reg.singleValue !== undefined) {
          val = Math.abs(reg.singleValue) < 1 ? reg.singleValue * 1000 : reg.singleValue;
        } else {
          const v = (reg as any)[pLow];
          if (v !== null && v !== undefined) val = Number(v) * 1000;
        }

        if (
          ['capacidad', 'rom', 'ros', 'retribucion', 'pago_om', 'pago_os', 'pago om', 'pago os'].some(
            k => conceptLow.includes(k)
          )
        ) {
          regLossAffected += val;
        } else if (conceptLow.includes('fnee')) {
          regNonLossTaxable += val;
        } else {
          regNonTaxableAtr += val;
        }
      }

      // 1. Mercado + SSAA + Desvíos vs Energía afecta a pérdidas (incluye PC, ROM, ROS)
      const unitMarketAndSsaa = baseMercado + sumComps + dsvVal;
      const unitEnergiaPura = unitMarketAndSsaa + regLossAffected;
      const unitCosteConPerdidas = unitEnergiaPura * lossF;
      const unitLossesOnly = unitCosteConPerdidas - unitEnergiaPura;

      // 2. Subtotal afecto a Tasa Municipal (1,5% -> / 0,985): incluye FNEE y Margen
      const taxableSubtotal = unitCosteConPerdidas + regNonLossTaxable + margin;
      const afterTasaSubtotal = taxableSubtotal / 0.985;
      const tasaMunicEur = afterTasaSubtotal - taxableSubtotal;

      // 3. Precio final ofertado al cliente (añade ATR energía exento de gross-up aquí)
      const unitPrecioFinal = afterTasaSubtotal + regNonTaxableAtr;
      const unitSubtotal = unitPrecioFinal - tasaMunicEur;
      const unitRegTotal = regLossAffected + regNonLossTaxable + regNonTaxableAtr;

      const mwh = hourlyKwh / 1000.0;
      const absTotal = unitPrecioFinal * mwh;

      // Desglose contable sin doble cómputo: la suma exacta de las 5 partidas iguala absTotal
      totalEnergyCostEur += unitMarketAndSsaa * mwh;
      totalLossesCostEur += unitLossesOnly * mwh;
      totalRegulatedCostEur += unitRegTotal * mwh;
      totalMarginEur += margin * mwh;
      totalMunicipalTaxEur += tasaMunicEur * mwh;
      totalPeriodKwh += hourlyKwh;

      const pb = periodsBreakdown[p];
      pb.consumption += hourlyKwh;
      pb.costAbs += absTotal;
      pb.energyAbs += unitMarketAndSsaa * mwh;
      pb.lossAbs += unitLossesOnly * mwh;
      pb.regAbs += unitRegTotal * mwh;

      hourlyDetails[i] = {
        datetime: mp.localIso,
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
        absTotalEur: absTotal,
      };
    }

    const finalEur = Object.values(periodsBreakdown).reduce((acc, pb) => acc + pb.costAbs, 0);
    const totalPeriodMwh = totalPeriodKwh / 1000.0;
    const marginGrossUp = margin / 0.985;

    const flatPriceEurMwh = totalPeriodMwh > 0 ? finalEur / totalPeriodMwh : 0;
    const flatCostEurMwh = flatPriceEurMwh - marginGrossUp;

    const periodsResult: QuoteResult['periods'] = {};
    for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
      const pb = periodsBreakdown[p];
      if (pb.consumption > 0) {
        const pMwh = pb.consumption / 1000.0;
        const priceEurMwh = pb.costAbs / pMwh;
        periodsResult[p] = {
          priceEurMwh,
          percentage: totalPeriodKwh > 0 ? (pb.consumption / totalPeriodKwh) * 100 : 0,
          costEurMwh: priceEurMwh - marginGrossUp,
          consumptionKwh: pb.consumption,
        };
      }
    }

    return {
      flatPriceEurMwh,
      flatCostEurMwh,
      totalConsumptionKwh: totalPeriodKwh,
      periods: periodsResult,
      breakdown: {
        energyCostEur: totalEnergyCostEur,
        lossesCostEur: totalLossesCostEur,
        regulatedCostEur: totalRegulatedCostEur,
        marginEur: totalMarginEur,
        municipalTaxEur: totalMunicipalTaxEur,
        totalEur: finalEur,
      },
      hourlyDetails,
    };
  }
}
