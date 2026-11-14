import { fromZonedTime } from 'date-fns-tz';

export interface PpaLike {
  id?: string;
  name?: string;
  type: 'FISICO' | 'FINANCIERO' | string;
  subtype: 'CARGA_BASE' | 'PERFIL_FIJO' | string;
  startDate: Date | string;
  endDate?: Date | string | null;
  priceType: 'FIJO' | 'INDEXADO' | string;
  priceValue?: number | null;
  basePowerMw?: number | null;
  profileData?: unknown;
  annualDegradationPct?: number | null;
  annualEscalationPct?: number | null;
  includeInPricing?: boolean;
}

export interface MadridDateTimeParts {
  year: number;
  month: number; // 1..12
  day: number;   // 1..31
  hour: number;  // 0..23
  dow: number;   // 0=Sun..6=Sat
  ymd: string;   // YYYY-MM-DD
  localIso: string; // YYYY-MM-DD HH:00
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Deterministic conversion of UTC epoch ms to Spanish peninsular time (Europe/Madrid, CET/CEST).
 * EU DST rule: starts last Sunday of March at 01:00 UTC, ends last Sunday of October at 01:00 UTC.
 */
export function getMadridPartsFromUtcMs(utcMs: number): MadridDateTimeParts {
  const approxYear = new Date(utcMs + 7200000).getUTCFullYear();
  const mar31Dow = new Date(Date.UTC(approxYear, 2, 31)).getUTCDay();
  const dstStartUtc = Date.UTC(approxYear, 2, 31 - mar31Dow, 1, 0, 0);
  const oct31Dow = new Date(Date.UTC(approxYear, 9, 31)).getUTCDay();
  const dstEndUtc = Date.UTC(approxYear, 9, 31 - oct31Dow, 1, 0, 0);
  const offsetMs = utcMs >= dstStartUtc && utcMs < dstEndUtc ? 7200000 : 3600000;
  const local = new Date(utcMs + offsetMs);

  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const hour = local.getUTCHours();
  const dow = local.getUTCDay();
  const mm = pad2(month);
  const dd = pad2(day);
  const ymd = `${year}-${mm}-${dd}`;

  return {
    year,
    month,
    day,
    hour,
    dow,
    ymd,
    localIso: `${ymd} ${pad2(hour)}:00`,
  };
}

/**
 * Extracts 'YYYY-MM-DD' in Europe/Madrid timezone without UTC -1 day shift.
 */
export function toMadridYmd(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const dt = value instanceof Date ? value : new Date(value);
  if (isNaN(dt.getTime())) return null;
  return getMadridPartsFromUtcMs(dt.getTime()).ymd;
}

/**
 * Formats 'YYYY-MM-DD' (or Date/ISO) as 'DD/MM/YYYY' in Europe/Madrid.
 */
export function formatMadridDateEs(value: Date | string | null | undefined): string {
  const ymd = toMadridYmd(value);
  if (!ymd) return '-';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Parses a 'YYYY-MM-DD' string into start-of-day (00:00:00.000) in Europe/Madrid.
 */
export function parseMadridStartOfDay(ymdOrIso: string): Date {
  const clean = ymdOrIso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return fromZonedTime(`${clean}T00:00:00.000`, 'Europe/Madrid');
  }
  const dt = new Date(clean);
  const ymd = toMadridYmd(dt);
  if (!ymd) throw new Error(`Fecha inválida: ${ymdOrIso}`);
  return fromZonedTime(`${ymd}T00:00:00.000`, 'Europe/Madrid');
}

/**
 * Parses a 'YYYY-MM-DD' string into end-of-day (23:59:59.999) in Europe/Madrid
 * so the final contract day is 100% included in any timestamp comparison.
 */
export function parseMadridEndOfDay(ymdOrIso: string): Date {
  const clean = ymdOrIso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return fromZonedTime(`${clean}T23:59:59.999`, 'Europe/Madrid');
  }
  const dt = new Date(clean);
  const ymd = toMadridYmd(dt);
  if (!ymd) throw new Error(`Fecha inválida: ${ymdOrIso}`);
  return fromZonedTime(`${ymd}T23:59:59.999`, 'Europe/Madrid');
}

export interface PpaMadridBounds {
  startYmd: string;
  endYmd: string | null;
  startYear: number;
  startMonth: number;
  startDay: number;
}

export function getPpaMadridBounds(ppa: Pick<PpaLike, 'startDate' | 'endDate'>): PpaMadridBounds {
  const startYmd = toMadridYmd(ppa.startDate) || '1970-01-01';
  const endYmd = toMadridYmd(ppa.endDate) || null;
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  return {
    startYmd,
    endYmd,
    startYear: sy,
    startMonth: sm,
    startDay: sd,
  };
}

export function isPpaActiveOnMadridYmd(
  ppa: Pick<PpaLike, 'startDate' | 'endDate'>,
  ymd: string
): boolean {
  const { startYmd, endYmd } = getPpaMadridBounds(ppa);
  if (ymd < startYmd) return false;
  if (endYmd && ymd > endYmd) return false;
  return true;
}

export function getPpaTemporalStatus(
  ppa: Pick<PpaLike, 'startDate' | 'endDate'>,
  referenceYmd?: string
): 'EN_VIGOR' | 'PROXIMO' | 'VENCIDO' {
  const todayYmd = referenceYmd || getMadridPartsFromUtcMs(Date.now()).ymd;
  const { startYmd, endYmd } = getPpaMadridBounds(ppa);
  if (todayYmd < startYmd) return 'PROXIMO';
  if (endYmd && todayYmd > endYmd) return 'VENCIDO';
  return 'EN_VIGOR';
}

/**
 * 0-based contract year index measured by contract anniversaries from startYmd.
 * Year 1 => 0, Year 2 => 1, etc.
 */
export function getContractYearIndex(startYmd: string, currentYmd: string): number {
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [cy, cm, cd] = currentYmd.split('-').map(Number);
  let years = cy - sy;
  if (cm < sm || (cm === sm && cd < sd)) {
    years -= 1;
  }
  return Math.max(0, years);
}

export function getDaysInCalendarMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/**
 * Returns an array of 24 integers indicating how many times each local clock hour (0..23)
 * occurs in Europe/Madrid during the given calendar month:
 * - March: hour 2 is skipped on the last Sunday => daysInMonth - 1 occurrences (30)
 * - October: hour 2 repeats on the last Sunday => daysInMonth + 1 occurrences (32)
 * - All other months/hours: daysInMonth occurrences.
 */
export function getClockHourOccurrencesInMonth(year: number, month1to12: number): number[] {
  const days = getDaysInCalendarMonth(year, month1to12);
  const counts = new Array<number>(24).fill(days);
  if (month1to12 === 3) {
    counts[2] = Math.max(1, days - 1);
  } else if (month1to12 === 10) {
    counts[2] = days + 1;
  }
  return counts;
}

/**
 * Maps an OMIE interval index (0..N-1) of a Spanish delivery day to its exact
 * local clock hour (0..23), minute (0, 15, 30, 45), and DST disambiguation tag ('A'|'B'|'').
 * Prevents +/-1h solar profile shifts on 23h (March) and 25h (October) DST days.
 */
export function mapOmieIntervalToMadridClock(
  index: number,
  totalIntervals: number
): {
  isQuarterly: boolean;
  clockHour: number;
  minute: number;
  dstTag: '' | 'A' | 'B';
  labelHm: string;
} {
  const isQuarterly = totalIntervals > 30;
  const totalHoursInDay = isQuarterly ? Math.round(totalIntervals / 4) : totalIntervals;
  const hIdx = isQuarterly ? Math.floor(index / 4) : index;
  const minute = isQuarterly ? (index % 4) * 15 : 0;

  let clockHour = hIdx;
  let dstTag: '' | 'A' | 'B' = '';

  if (totalHoursInDay === 23) {
    // Spring forward: 00, 01, 03..23 (02:00 does not exist)
    clockHour = hIdx < 2 ? hIdx : Math.min(23, hIdx + 1);
  } else if (totalHoursInDay === 25) {
    // Fall back: 00, 01, 02A, 02B, 03..23
    if (hIdx < 2) {
      clockHour = hIdx;
    } else if (hIdx === 2) {
      clockHour = 2;
      dstTag = 'A';
    } else if (hIdx === 3) {
      clockHour = 2;
      dstTag = 'B';
    } else {
      clockHour = Math.min(23, hIdx - 1);
    }
  } else {
    clockHour = Math.min(23, Math.max(0, hIdx));
  }

  const labelHm = `${pad2(clockHour)}:${pad2(minute)}${dstTag ? ` (${dstTag})` : ''}`;
  return { isQuarterly, clockHour, minute, dstTag, labelHm };
}

/**
 * Computes the PPA hourly MWh volume for a specific Madrid calendar date and clock hour (0..23),
 * supporting all 4 combinations (FISICO/FINANCIERO x CARGA_BASE/PERFIL_FIJO),
 * annual linear degradation, and exact DST monthly occurrences.
 */
export function calculatePpaHourlyMwh(
  ppa: PpaLike,
  year: number,
  month1to12: number,
  day: number,
  clockHour: number,
  hourOccurrencesOverride?: number[]
): number {
  const ymd = `${year}-${pad2(month1to12)}-${pad2(day)}`;
  const bounds = getPpaMadridBounds(ppa);
  if (ymd < bounds.startYmd) return 0;
  if (bounds.endYmd && ymd > bounds.endYmd) return 0;

  const yearIdx = getContractYearIndex(bounds.startYmd, ymd);
  const degPct = Number(ppa.annualDegradationPct ?? 0) || 0;
  const degFactor = Math.max(0, 1 - (degPct / 100) * yearIdx);

  if (ppa.subtype === 'CARGA_BASE') {
    const baseMw = Number(ppa.basePowerMw ?? 0) || 0;
    return baseMw * degFactor;
  }

  if (ppa.subtype === 'PERFIL_FIJO' && Array.isArray(ppa.profileData)) {
    const profile = ppa.profileData as unknown[][];
    const m0 = month1to12 - 1;
    const h = Math.min(23, Math.max(0, clockHour));
    const rawMonthlyMwh = profile[m0] && profile[m0][h] !== undefined ? Number(profile[m0][h]) : 0;
    const monthlyMwh = Number.isFinite(rawMonthlyMwh) ? rawMonthlyMwh : 0;
    if (monthlyMwh === 0) return 0;

    const occurrences =
      hourOccurrencesOverride?.[h] ??
      getClockHourOccurrencesInMonth(year, month1to12)[h] ??
      getDaysInCalendarMonth(year, month1to12);

    return (monthlyMwh / occurrences) * degFactor;
  }

  return 0;
}

export interface PpaIntervalFinancials {
  /** Effective PPA contractual unit price (€/MWh): Strike (if FIJO) or OMIE + Fee (if INDEXADO), escalated by annualEscalationPct */
  unitContractPriceEurMwh: number;
  /** Escalated strike or fee parameter (€/MWh) */
  escalatedParamValue: number;
  /** CfD differential (€/MWh) = OMIE - unitContractPriceEurMwh */
  unitDiffVsOmieEurMwh: number;
  /** Mark-to-Market / CfD benefit for the retailer (€): (OMIE - unitContractPrice) * MWh (>0 in favor of retailer, <0 in favor of producer) */
  cfdOrMtmEur: number;
  /** Physical bilateral purchase invoice cost to pay producer (€): unitContractPrice * MWh for FISICO, 0 for FINANCIERO */
  physicalInvoiceCostEur: number;
  /** Primary settlement metric displayed for this contract type (€): cfdOrMtmEur for FINANCIERO, physicalInvoiceCostEur for FISICO */
  primarySettlementEur: number;
  /** Primary unit price displayed in detailed table (€/MWh) */
  primaryAppliedUnitEurMwh: number;
}

/**
 * Calculates full interval financials for any PPA combination (FISICO/FINANCIERO x FIJO/INDEXADO),
 * applying annual price/fee escalation (`annualEscalationPct`) on contract anniversaries.
 */
export function calculatePpaIntervalFinancials(
  ppa: PpaLike,
  mwh: number,
  omiePriceEurMwh: number,
  year: number,
  month1to12: number,
  day: number
): PpaIntervalFinancials {
  const ymd = `${year}-${pad2(month1to12)}-${pad2(day)}`;
  const bounds = getPpaMadridBounds(ppa);
  const yearIdx = getContractYearIndex(bounds.startYmd, ymd);
  const escPct = Number(ppa.annualEscalationPct ?? 0) || 0;
  const escFactor = Math.pow(1 + escPct / 100, yearIdx);

  const rawParam = ppa.priceValue !== null && ppa.priceValue !== undefined ? Number(ppa.priceValue) : 0;
  const baseParam = Number.isFinite(rawParam) ? rawParam : 0;
  const escalatedParamValue = baseParam * escFactor;

  const isFijo = ppa.priceType === 'FIJO';
  const isFinanciero = ppa.type === 'FINANCIERO';

  const unitContractPriceEurMwh = isFijo
    ? escalatedParamValue
    : omiePriceEurMwh + escalatedParamValue;

  const unitDiffVsOmieEurMwh = omiePriceEurMwh - unitContractPriceEurMwh;
  const cfdOrMtmEur = mwh * unitDiffVsOmieEurMwh;
  const physicalInvoiceCostEur = isFinanciero ? 0 : mwh * unitContractPriceEurMwh;

  // For FINANCIERO (CfD / Swap): settlement is the net difference vs OMIE (+ cobro / - pago).
  // For FISICO: primary invoice is the bilateral energy purchase cost paid to the generator.
  const primarySettlementEur = isFinanciero ? cfdOrMtmEur : physicalInvoiceCostEur;
  const primaryAppliedUnitEurMwh = isFinanciero ? unitDiffVsOmieEurMwh : unitContractPriceEurMwh;

  return {
    unitContractPriceEurMwh,
    escalatedParamValue,
    unitDiffVsOmieEurMwh,
    cfdOrMtmEur,
    physicalInvoiceCostEur,
    primarySettlementEur,
    primaryAppliedUnitEurMwh,
  };
}

/**
 * Estimates Year-1 nominal annual energy (MWh/year) of a PPA for UI listings and KPIs.
 */
export function estimateNominalAnnualMwh(ppa: Pick<PpaLike, 'subtype' | 'basePowerMw' | 'profileData'>): number {
  if (ppa.subtype === 'CARGA_BASE') {
    return (Number(ppa.basePowerMw ?? 0) || 0) * 8760;
  }
  if (ppa.subtype === 'PERFIL_FIJO' && Array.isArray(ppa.profileData)) {
    let sum = 0;
    for (const monthArr of ppa.profileData as unknown[]) {
      if (Array.isArray(monthArr)) {
        for (const val of monthArr) {
          const n = Number(val);
          if (Number.isFinite(n)) sum += n;
        }
      }
    }
    return sum;
  }
  return 0;
}

/**
 * Validates that a profileData value is a well-formed 12x24 numeric matrix with non-negative finite numbers.
 */
export function validateProfileMatrix(profileData: unknown): { valid: boolean; error?: string; normalized?: number[][] } {
  if (!Array.isArray(profileData) || profileData.length !== 12) {
    return { valid: false, error: 'La matriz de perfil fijo debe tener exactamente 12 meses.' };
  }
  const normalized: number[][] = [];
  let totalSum = 0;

  for (let m = 0; m < 12; m++) {
    const row = profileData[m];
    if (!Array.isArray(row) || row.length !== 24) {
      return { valid: false, error: `El mes ${m + 1} debe contener exactamente 24 valores horarios.` };
    }
    const cleanMonth: number[] = [];
    for (let h = 0; h < 24; h++) {
      const raw = row[h];
      const num = typeof raw === 'string' ? Number(raw.replace(',', '.')) : Number(raw ?? 0);
      if (!Number.isFinite(num) || num < 0) {
        return { valid: false, error: `Valor inválido en mes ${m + 1}, hora ${h}: "${raw}".` };
      }
      cleanMonth.push(num);
      totalSum += num;
    }
    normalized.push(cleanMonth);
  }

  if (totalSum <= 0) {
    return { valid: false, error: 'La matriz de perfil fijo tiene 0 MWh en todo el año. Revisa el archivo Excel.' };
  }

  return { valid: true, normalized };
}
