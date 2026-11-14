import { fromZonedTime } from 'date-fns-tz';
import { getSpanishPostalPrefix, pickSpanishPostalCode } from './postalCode';

export const MADRID_TZ = 'Europe/Madrid';
export const STANDARD_IEE_RATE = 5.11269632;

export type TaxZone = 'España' | 'Navarra' | 'Álava' | 'Guipúzcoa' | 'Vizcaya';
export type IeeRateBucket = '5.11' | '3.8' | '2.5' | '0.5';
export type ExportMode560 = 'oficial' | 'neteado';

export interface Regimen560Meta {
  code: string;
  exempt: boolean;
  reductionPct: number; // 0, 85, or 100
  allowsMin: boolean;
  alwaysMin: boolean;
  aggregateAll: boolean; // true for SBFO, SBFI, 94.1..94.4, 94.10
  requiresNif: boolean;
  requiresCie: boolean;
  cieActivityKeys?: string[]; // Expected chars at index 7..9 of 13-char CIE
}

export const REGIMEN_560_META: Record<string, Regimen560Meta> = {
  '94.1':  { code: '94.1',  exempt: true,  reductionPct: 0,   allowsMin: false, alwaysMin: false, aggregateAll: true,  requiresNif: false, requiresCie: false },
  '94.2':  { code: '94.2',  exempt: true,  reductionPct: 0,   allowsMin: false, alwaysMin: false, aggregateAll: true,  requiresNif: false, requiresCie: false },
  '94.3':  { code: '94.3',  exempt: true,  reductionPct: 0,   allowsMin: false, alwaysMin: false, aggregateAll: true,  requiresNif: false, requiresCie: false },
  '94.4':  { code: '94.4',  exempt: true,  reductionPct: 0,   allowsMin: false, alwaysMin: false, aggregateAll: true,  requiresNif: false, requiresCie: false },
  '94.5':  { code: '94.5',  exempt: true,  reductionPct: 0,   allowsMin: false, alwaysMin: false, aggregateAll: false, requiresNif: true,  requiresCie: true,  cieActivityKeys: ['LO', 'L0'] },
  '94.6':  { code: '94.6',  exempt: true,  reductionPct: 0,   allowsMin: false, alwaysMin: false, aggregateAll: false, requiresNif: true,  requiresCie: true,  cieActivityKeys: ['LP'] },
  '94.7':  { code: '94.7',  exempt: true,  reductionPct: 0,   allowsMin: false, alwaysMin: false, aggregateAll: false, requiresNif: true,  requiresCie: true,  cieActivityKeys: ['L1', 'L7'] },
  '94.8':  { code: '94.8',  exempt: true,  reductionPct: 0,   allowsMin: false, alwaysMin: false, aggregateAll: false, requiresNif: true,  requiresCie: false },
  '94.9':  { code: '94.9',  exempt: true,  reductionPct: 0,   allowsMin: false, alwaysMin: false, aggregateAll: false, requiresNif: true,  requiresCie: false },
  '94.10': { code: '94.10', exempt: true,  reductionPct: 0,   allowsMin: false, alwaysMin: false, aggregateAll: true,  requiresNif: false, requiresCie: false },
  '98.1A': { code: '98.1A', exempt: false, reductionPct: 85,  allowsMin: false, alwaysMin: false, aggregateAll: false, requiresNif: true,  requiresCie: true,  cieActivityKeys: ['LQ'] },
  '98.1B': { code: '98.1B', exempt: false, reductionPct: 85,  allowsMin: false, alwaysMin: false, aggregateAll: false, requiresNif: true,  requiresCie: true,  cieActivityKeys: ['LM'] },
  '98.1C': { code: '98.1C', exempt: false, reductionPct: 85,  allowsMin: false, alwaysMin: false, aggregateAll: false, requiresNif: true,  requiresCie: true,  cieActivityKeys: ['LE'] },
  '98.1D': { code: '98.1D', exempt: false, reductionPct: 85,  allowsMin: false, alwaysMin: false, aggregateAll: false, requiresNif: true,  requiresCie: true,  cieActivityKeys: ['LI'] },
  '98.1E': { code: '98.1E', exempt: false, reductionPct: 85,  allowsMin: true,  alwaysMin: false, aggregateAll: false, requiresNif: true,  requiresCie: true,  cieActivityKeys: ['LA'] },
  '98.1F': { code: '98.1F', exempt: false, reductionPct: 85,  allowsMin: true,  alwaysMin: false, aggregateAll: false, requiresNif: true,  requiresCie: true,  cieActivityKeys: ['LV'] },
  '98.2':  { code: '98.2',  exempt: false, reductionPct: 100, allowsMin: true,  alwaysMin: true,  aggregateAll: false, requiresNif: true,  requiresCie: false },
  '98.3':  { code: '98.3',  exempt: false, reductionPct: 100, allowsMin: true,  alwaysMin: true,  aggregateAll: false, requiresNif: true,  requiresCie: false },
  'SBFI':  { code: 'SBFI',  exempt: false, reductionPct: 0,   allowsMin: true,  alwaysMin: false, aggregateAll: true,  requiresNif: false, requiresCie: false },
  'SBFO':  { code: 'SBFO',  exempt: false, reductionPct: 0,   allowsMin: true,  alwaysMin: false, aggregateAll: true,  requiresNif: false, requiresCie: false },
};

/**
 * Redondeo comercial simétrico a 2 decimales (Art. 99 LIIEE / INST_CUMPL_560 pág. 2).
 */
export function round2(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  const r = Math.sign(n) * (Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100);
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Redondeo comercial simétrico a 3 decimales (MWh en Modelo 560).
 */
export function round3(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  const r = Math.sign(n) * (Math.round((Math.abs(n) + Number.EPSILON) * 1000) / 1000);
  return Object.is(r, -0) ? 0 : r;
}

export function trunc2(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  const sign = n < 0 ? -1 : 1;
  // Pequeña tolerancia IEEE-754 (1e-9) para no truncar 12.8100000000000005 o 12.809999999999999 erróneamente
  const r = sign * (Math.floor((Math.abs(n) + 1e-9) * 100) / 100);
  return Object.is(r, -0) ? 0 : r;
}

export function fmt2(n: number): string {
  return round2(n).toFixed(2);
}

export function fmt3(n: number): string {
  return round3(n).toFixed(3);
}

export function fmtAeatComma2(n: number): string {
  return fmt2(n).replace('.', ',');
}

export function fmtAeatComma3(n: number): string {
  return fmt3(n).replace('.', ',');
}

export function parseTaxNum(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val).trim().replace(',', '.');
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Calcula inicio y fin exactos de un trimestre en huso horario oficial Europe/Madrid (Regla 112).
 */
export function getQuarterMadridBounds(year: number, quarter: number): { startDate: Date; endDate: Date } {
  if (quarter === 1) {
    return {
      startDate: fromZonedTime(`${year}-01-01T00:00:00.000`, MADRID_TZ),
      endDate: fromZonedTime(`${year}-03-31T23:59:59.999`, MADRID_TZ),
    };
  }
  if (quarter === 2) {
    return {
      startDate: fromZonedTime(`${year}-04-01T00:00:00.000`, MADRID_TZ),
      endDate: fromZonedTime(`${year}-06-30T23:59:59.999`, MADRID_TZ),
    };
  }
  if (quarter === 3) {
    return {
      startDate: fromZonedTime(`${year}-07-01T00:00:00.000`, MADRID_TZ),
      endDate: fromZonedTime(`${year}-09-30T23:59:59.999`, MADRID_TZ),
    };
  }
  return {
    startDate: fromZonedTime(`${year}-10-01T00:00:00.000`, MADRID_TZ),
    endDate: fromZonedTime(`${year}-12-31T23:59:59.999`, MADRID_TZ),
  };
}

/**
 * Calcula inicio (00:00:00.000) y fin (23:59:59.999) en Europe/Madrid a partir de YYYY-MM-DD.
 */
export function getDateRangeMadridBounds(startStr: string, endStr: string): { startDate: Date; endDate: Date } {
  const sClean = startStr.trim().substring(0, 10);
  const eClean = endStr.trim().substring(0, 10);
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/;

  const startDate = isIsoDate.test(sClean)
    ? fromZonedTime(`${sClean}T00:00:00.000`, MADRID_TZ)
    : new Date(startStr);

  const endDate = isIsoDate.test(eClean)
    ? fromZonedTime(`${eClean}T23:59:59.999`, MADRID_TZ)
    : (() => {
        const d = new Date(endStr);
        d.setHours(23, 59, 59, 999);
        return d;
      })();

  return { startDate, endDate };
}

/**
 * Valida un CIE (13 caracteres) frente al régimen fiscal del Modelo 560 (Orden HAC/172/2021).
 */
export function validateCieForRegimen(
  cieRaw: string | null | undefined,
  regimenRaw: string | null | undefined
): { valid: boolean; normalizedCie: string; error?: string } {
  const regimen = (regimenRaw || 'SBFO').trim().toUpperCase();
  const meta = REGIMEN_560_META[regimen] || REGIMEN_560_META['SBFO'];
  const cie = (cieRaw || '').trim().toUpperCase().replace(/\s+/g, '');

  if (!meta.requiresCie) {
    if (!cie) return { valid: true, normalizedCie: '' };
    if (cie.length !== 13 || !/^[A-Z]{2}[A-Z0-9]{11}$/.test(cie)) {
      return {
        valid: false,
        normalizedCie: cie,
        error: `El CIE "${cie}" no tiene el formato oficial de 13 caracteres (ej. ES000XXLA000X).`,
      };
    }
    return { valid: true, normalizedCie: cie };
  }

  if (!cie) {
    const expectedKeys = meta.cieActivityKeys?.join(' o ') || '';
    return {
      valid: false,
      normalizedCie: '',
      error: `El régimen ${regimen} exige obligatoriamente el CIE del beneficiario (13 caracteres con clave ${expectedKeys}).`,
    };
  }

  if (cie.length !== 13 || !/^ES[A-Z0-9]{11}$/.test(cie)) {
    return {
      valid: false,
      normalizedCie: cie,
      error: `El CIE "${cie}" debe tener exactamente 13 caracteres comenzando por ES (ej. ES00041${meta.cieActivityKeys?.[0] || 'LA'}000X).`,
    };
  }

  if (meta.cieActivityKeys && meta.cieActivityKeys.length > 0) {
    const actKey = cie.substring(7, 9);
    if (!meta.cieActivityKeys.includes(actKey)) {
      return {
        valid: false,
        normalizedCie: cie,
        error: `Para el régimen ${regimen}, los caracteres 8-9 del CIE deben ser "${meta.cieActivityKeys.join('" o "')}" (recibido: "${actKey}" en ${cie}).`,
      };
    }
  }

  return { valid: true, normalizedCie: cie };
}

export function validateDeclarantCie(cieRaw: string | null | undefined): { valid: boolean; normalizedCie: string; warning?: string } {
  const cie = (cieRaw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cie) {
    return {
      valid: false,
      normalizedCie: '',
      warning: 'La comercializadora no tiene configurado su CIE de declarante (13 caracteres, clave L3) en Configuración -> Empresas.',
    };
  }
  if (cie.length !== 13 || !/^[A-Z]{2}[A-Z0-9]{11}$/.test(cie)) {
    return {
      valid: false,
      normalizedCie: cie,
      warning: `El CIE de la comercializadora ("${cie}") no tiene 13 caracteres válidos.`,
    };
  }
  return { valid: true, normalizedCie: cie };
}

/**
 * Determina la Agencia Tributaria competente según ubicación física del suministro (Art. 91.1 LIIEE).
 * Canarias (35, 38), Ceuta (51) y Melilla (52) tributan en 'España' (AEAT Estatal).
 * Solo Navarra (31) y País Vasco (01, 20, 48) tributan en Haciendas Forales.
 */
export function resolveTaxZone(supplyPoint: any, invoiceData: any): TaxZone {
  const cp = pickSpanishPostalCode(
    supplyPoint?.postalCode,
    supplyPoint?.sipsPostalCode,
    invoiceData?.['CP PS'],
    invoiceData?.['Codigo Postal PS']
  );
  const cpPrefix = getSpanishPostalPrefix(cp);

  const prov = String(
    supplyPoint?.province ||
    invoiceData?.['PROVINCIA PS'] ||
    invoiceData?.['Provincia PS'] ||
    ''
  )
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (cpPrefix === '31' || prov.includes('navarra') || prov.includes('nafarroa')) {
    return 'Navarra';
  }
  if (cpPrefix === '01' || prov.includes('alava') || prov.includes('araba')) {
    return 'Álava';
  }
  if (cpPrefix === '20' || prov.includes('guipuzcoa') || prov.includes('gipuzkoa')) {
    return 'Guipúzcoa';
  }
  if (cpPrefix === '48' || prov.includes('vizcaya') || prov.includes('bizkaia')) {
    return 'Vizcaya';
  }
  return 'España';
}

export function resolveRegimenFiscal(supplyPoint: any): string {
  const raw = (supplyPoint?.regimenFiscal || '').trim().toUpperCase();
  if (raw && raw !== 'SBFO' && raw !== 'SBFI' && REGIMEN_560_META[raw]) {
    return raw;
  }
  if (raw === 'SBFI') return 'SBFI';

  const cnaeStr = String(supplyPoint?.cnae || '').trim();
  const cnaePrefix = parseInt(cnaeStr.substring(0, 2), 10);
  if (!Number.isNaN(cnaePrefix) && cnaePrefix >= 5 && cnaePrefix <= 33) {
    return 'SBFI';
  }
  return 'SBFO';
}

export function resolveIeeRateBucket(inv: any, data: any): { bucket: IeeRateBucket; numericRate: number } {
  const rawDataPct = data?.['Impuesto (%)'] ?? data?.['ieeRate'];
  let pct = rawDataPct !== undefined && rawDataPct !== null && String(rawDataPct).trim() !== ''
    ? parseTaxNum(rawDataPct)
    : parseTaxNum(inv?.taxPercentage);

  // Salvaguarda: si por error algún registro interno guardó 21% (IVA) en taxPercentage, usar 5.11269632%
  if (!pct || Math.abs(pct - 21) < 0.5 || pct < 0) {
    pct = STANDARD_IEE_RATE;
  }

  if (Math.abs(pct - 0.5) < 0.15) return { bucket: '0.5', numericRate: 0.5 };
  if (Math.abs(pct - 2.5) < 0.2) return { bucket: '2.5', numericRate: 2.5 };
  if (Math.abs(pct - 3.8) < 0.2) return { bucket: '3.8', numericRate: 3.8 };
  return { bucket: '5.11', numericRate: STANDARD_IEE_RATE };
}

export function isPenaltyInvoiceRecord(inv: any, data: any): boolean {
  const invType = String(inv?.invoiceType || data?.['Tipo Factura'] || '').toLowerCase();
  const invNum = String(inv?.invoiceNumber || '').toUpperCase();
  if (invType.includes('penaliz')) return true;
  if (/^A\d{2}PEN\d+/.test(invNum)) return true;
  return false;
}

export interface ZoneCuadroLiquidacion {
  zona: TaxZone;
  rateBucket: IeeRateBucket;
  numericRate: number;
  casilla1BaseImponible: number;
  casilla2BaseLiquidable: number;
  casilla3CuotaIntegra: number;
  casilla4CantidadMwh: number;
  casilla5CuotaMinima: number;
  casilla6TotalIngresar: number;
  exemptCantidadMwh: number;
  exemptBaseImponible: number;
  centAdjustmentEur: number;
  rawCasilla2BeforeAdjust: number;
  hasNegativeMinQuota: boolean;
  invoiceCount: number;
  txtLines: string[];
}

export interface SummaryRow560 {
  zona: TaxZone;
  rateBucket: IeeRateBucket;
  tipo: number;
  baseImponibleBruta: number;
  baseSujeta: number; // Base Liquidable (100% en SBFO/SBFI, 15% en 98.1A-F)
  impuestoBase: number;
  consumoMinimo: number;
  impuestoMinimo: number;
  exemptMwh: number;
  total: number;
  isMinApplied: boolean;
  isHistoricalRate: boolean;
}

export interface Modelo560Computation {
  summaryRows: SummaryRow560[];
  cuadrosByZone: Record<string, ZoneCuadroLiquidacion>;
  historicalQuotesCount: number;
  historicalZones: Array<{ zona: TaxZone; rateBucket: IeeRateBucket; count: number; totalQuota: number }>;
  warnings: string[];
  cieErrors: string[];
  declarantCie: string;
  companyName: string;
}

interface ParsedFact560 {
  zona: TaxZone;
  rateBucket: IeeRateBucket;
  numericRate: number;
  regimen: string;
  meta: Regimen560Meta;
  isNegative: boolean;
  isMinApplied: boolean;
  subtotal: number;
  reduccion: number;
  baseLiquidable: number;
  energyMwh: number;
  taxAmount: number;
  nifDestinatario: string;
  cieDestinatario: string;
  tension: string;
  concepto: string;
  cups: string;
  invoiceNumber: string;
}

export function computeModelo560(params: {
  invoices: any[];
  declarantCie: string;
  companyName?: string;
  targetRateBucket?: IeeRateBucket;
  mode?: ExportMode560;
  adjustCents?: boolean;
}): Modelo560Computation {
  const {
    invoices,
    declarantCie,
    companyName = '',
    targetRateBucket = '5.11',
    mode = 'oficial',
    adjustCents = true,
  } = params;

  const cieCheck = validateDeclarantCie(declarantCie);
  const effectiveDeclarantCie = cieCheck.normalizedCie;
  const warnings: string[] = [];
  const cieErrorsSet = new Set<string>();

  if (cieCheck.warning) {
    warnings.push(cieCheck.warning);
  }

  const seenInvoices = new Set<string>();
  const facts: ParsedFact560[] = [];
  const historicalMap = new Map<string, { zona: TaxZone; rateBucket: IeeRateBucket; count: number; totalQuota: number }>();

  for (const inv of invoices) {
    if (inv.invoiceNumber) {
      if (seenInvoices.has(inv.invoiceNumber)) continue;
      seenInvoices.add(inv.invoiceNumber);
    }

    const data = (inv.invoiceData as Record<string, any> | null) || {};
    if (isPenaltyInvoiceRecord(inv, data)) continue;

    const isAbono =
      String(inv.invoiceType || data['Tipo Factura'] || '').toLowerCase().includes('abono') ||
      String(inv.invoiceNumber || '').toUpperCase().startsWith('AB-');

    const regimen = resolveRegimenFiscal(inv.supplyPoint);
    const meta = REGIMEN_560_META[regimen] || REGIMEN_560_META['SBFO'];

    // Extracción de Base Imponible IE ("Subtotal 1" en CSV o baseIEE en motor interno)
    let subtotal =
      data['BI Subtotal 1 CORR'] !== undefined
        ? parseTaxNum(data['BI Subtotal 1 CORR'])
        : data['Subtotal 1'] !== undefined
          ? parseTaxNum(data['Subtotal 1'])
          : data['baseIEE'] !== undefined
            ? parseTaxNum(data['baseIEE'])
            : parseTaxNum(inv.subtotal1);

    // Extracción de Cuota IE ("Importe Impuesto" en CSV o taxElectric en motor interno)
    let taxAmount =
      data['Importe Impuesto CORR'] !== undefined
        ? parseTaxNum(data['Importe Impuesto CORR'])
        : data['Importe Impuesto'] !== undefined
          ? parseTaxNum(data['Importe Impuesto'])
          : data['taxElectric'] !== undefined
            ? parseTaxNum(data['taxElectric'])
            : inv.origin === 'INTERNAL_ENGINE'
              ? 0
              : parseTaxNum(inv.taxAmount);

    // Extracción de Energía en MWh (en Invoice y CSV está en kWh según Regla 81)
    let energyKwh =
      data['Cantidad Energía Total Consumida CORR'] !== undefined
        ? parseTaxNum(data['Cantidad Energía Total Consumida CORR'])
        : data['Energía Total Consumida'] !== undefined
          ? parseTaxNum(data['Energía Total Consumida'])
          : parseTaxNum(inv.totalMWh);

    let energyMwh = energyKwh / 1000.0;

    if (isAbono) {
      if (subtotal > 0) subtotal = -subtotal;
      if (taxAmount > 0) taxAmount = -taxAmount;
      if (energyMwh > 0) energyMwh = -energyMwh;
    }

    subtotal = round2(subtotal);
    taxAmount = round2(taxAmount);
    energyMwh = round3(energyMwh);

    // Omitir facturas sin hecho imponible eléctrico (salvo exentas Art. 94 con consumo físico)
    if (meta.exempt) {
      taxAmount = 0;
      if (subtotal === 0 && energyMwh === 0) continue;
    } else {
      if (taxAmount === 0) continue;
    }

    const zona = resolveTaxZone(inv.supplyPoint, data);
    const { bucket: rateBucket, numericRate } = resolveIeeRateBucket(inv, data);

    // Determinación exacta de si aplicó Cuota Mínima (Art. 99.2) o Porcentaje (Art. 99.1)
    let isMinApplied = false;
    if (meta.exempt) {
      isMinApplied = false;
    } else if (meta.alwaysMin) {
      isMinApplied = true;
    } else if (!meta.allowsMin) {
      isMinApplied = false;
    } else {
      const minSuperadoValue = data['Minimo Importe IE Superado'] ?? data.minimoImporteIESuperado;
      if (minSuperadoValue !== undefined && minSuperadoValue !== null && String(minSuperadoValue).trim() !== '') {
        const flag = String(minSuperadoValue).trim().toLowerCase();
        isMinApplied = flag === '0' || flag === 'false' || flag === 'no';
      } else {
        const effectiveRedPct =
          meta.reductionPct > 0
            ? meta.reductionPct
            : inv.supplyPoint?.ieDiscount && inv.supplyPoint.ieDiscount > 0
              ? Math.min(100, Number(inv.supplyPoint.ieDiscount))
              : 0;
        const expectedPctQuota = Math.abs(subtotal) * (1 - effectiveRedPct / 100.0) * (numericRate / 100.0);
        const absTax = Math.abs(taxAmount);
        const absEnergy = Math.abs(energyMwh);

        if (absTax > 0 && Math.abs(absTax - expectedPctQuota) <= 0.03) {
          isMinApplied = false;
        } else if (absEnergy > 0) {
          const min05 = absEnergy * 0.5;
          const min10 = absEnergy * 1.0;
          const tol = Math.max(0.03, absEnergy * 0.02);
          if (
            expectedPctQuota < Math.max(min05, min10) + 0.03 &&
            (Math.abs(absTax - min05) <= tol || Math.abs(absTax - min10) <= tol)
          ) {
            isMinApplied = true;
          }
        }
      }
    }

    // Cálculo de Reducción y Base Liquidable según ANEXO TABLA AEAT
    let reduccion = 0;
    let baseLiquidable = subtotal;
    if (meta.exempt) {
      reduccion = 0;
      baseLiquidable = 0;
    } else if (meta.reductionPct === 100) {
      reduccion = subtotal;
      baseLiquidable = 0;
    } else if (meta.reductionPct === 85) {
      const spDisc =
        inv.supplyPoint?.ieDiscount && inv.supplyPoint.ieDiscount > 0 && inv.supplyPoint.ieDiscount <= 100
          ? Number(inv.supplyPoint.ieDiscount)
          : 85;
      reduccion = round2(subtotal * (spDisc / 100.0));
      baseLiquidable = round2(subtotal - reduccion);
    } else {
      reduccion = 0;
      baseLiquidable = isMinApplied ? 0 : subtotal;
    }

    const nifDestinatario = meta.requiresNif
      ? String(inv.client?.vatNumber || data['NIF Cliente'] || '').trim().toUpperCase()
      : '';

    const rawCieDest = meta.requiresCie ? String(inv.supplyPoint?.cie || '').trim().toUpperCase() : '';
    if (meta.requiresNif && !nifDestinatario) {
      cieErrorsSet.add(
        `CUPS ${inv.supplyPoint?.cups || 'S/N'} (${regimen}): Falta el NIF del cliente destinatario.`
      );
    }
    if (meta.requiresCie) {
      const destCheck = validateCieForRegimen(rawCieDest, regimen);
      if (!destCheck.valid && destCheck.error) {
        cieErrorsSet.add(`CUPS ${inv.supplyPoint?.cups || 'S/N'}: ${destCheck.error}`);
      }
    }

    const tarifa = String(data['Tarifa'] || inv.supplyPoint?.tariff || '').trim().toUpperCase();
    const tension = !meta.aggregateAll && tarifa.startsWith('6.') ? 'A' : '';
    const conceptoRaw = String(data['Concepto 560'] || '').trim().toUpperCase();
    const concepto = conceptoRaw === 'R' || conceptoRaw === 'D' ? conceptoRaw : '';

    const isNegative = taxAmount < 0 || (taxAmount === 0 && (subtotal < 0 || energyMwh < 0));

    if (!isMinApplied && !meta.exempt && rateBucket !== '5.11') {
      const hKey = `${zona}_${rateBucket}`;
      const prev = historicalMap.get(hKey) || { zona, rateBucket, count: 0, totalQuota: 0 };
      prev.count += 1;
      prev.totalQuota = round2(prev.totalQuota + taxAmount);
      historicalMap.set(hKey, prev);
    }

    facts.push({
      zona,
      rateBucket: isMinApplied || meta.exempt ? '5.11' : rateBucket,
      numericRate: isMinApplied || meta.exempt ? STANDARD_IEE_RATE : numericRate,
      regimen,
      meta,
      isNegative,
      isMinApplied,
      subtotal,
      reduccion,
      baseLiquidable,
      energyMwh,
      taxAmount,
      nifDestinatario,
      cieDestinatario: rawCieDest,
      tension,
      concepto,
      cups: inv.supplyPoint?.cups || '',
      invoiceNumber: inv.invoiceNumber || '',
    });
  }

  // 1. Construir filas resumen para la tabla visual (separando tipos históricos para no mezclarlos con 5.11%)
  const summaryMap = new Map<string, SummaryRow560>();
  for (const f of facts) {
    if (f.meta.exempt) {
      const sKey = `${f.zona}_EXENTO`;
      if (!summaryMap.has(sKey)) {
        summaryMap.set(sKey, {
          zona: f.zona,
          rateBucket: '5.11',
          tipo: 0,
          baseImponibleBruta: 0,
          baseSujeta: 0,
          impuestoBase: 0,
          consumoMinimo: 0,
          impuestoMinimo: 0,
          exemptMwh: 0,
          total: 0,
          isMinApplied: false,
          isHistoricalRate: false,
        });
      }
      const r = summaryMap.get(sKey)!;
      r.baseImponibleBruta = round2(r.baseImponibleBruta + f.subtotal);
      r.exemptMwh = round3(r.exemptMwh + f.energyMwh);
      continue;
    }

    const displayRate = f.isMinApplied ? 0 : round2(f.numericRate);
    const sKey = `${f.zona}_${f.rateBucket}_${f.isMinApplied}`;
    if (!summaryMap.has(sKey)) {
      summaryMap.set(sKey, {
        zona: f.zona,
        rateBucket: f.rateBucket,
        tipo: displayRate,
        baseImponibleBruta: 0,
        baseSujeta: 0,
        impuestoBase: 0,
        consumoMinimo: 0,
        impuestoMinimo: 0,
        exemptMwh: 0,
        total: 0,
        isMinApplied: f.isMinApplied,
        isHistoricalRate: !f.isMinApplied && f.rateBucket !== '5.11',
      });
    }
    const row = summaryMap.get(sKey)!;
    if (f.isMinApplied) {
      row.baseImponibleBruta = round2(row.baseImponibleBruta + f.subtotal);
      row.consumoMinimo = round3(row.consumoMinimo + f.energyMwh);
      row.impuestoMinimo = round2(row.impuestoMinimo + f.taxAmount);
    } else {
      row.baseImponibleBruta = round2(row.baseImponibleBruta + f.subtotal);
      row.baseSujeta = round2(row.baseSujeta + f.baseLiquidable);
      row.impuestoBase = round2(row.impuestoBase + f.taxAmount);
    }
    row.total = round2(row.total + f.taxAmount);
  }

  const summaryRows = Array.from(summaryMap.values()).sort((a, b) => {
    if (a.zona === 'España' && b.zona !== 'España') return -1;
    if (b.zona === 'España' && a.zona !== 'España') return 1;
    if (a.zona !== b.zona) return a.zona.localeCompare(b.zona);
    if (a.isMinApplied !== b.isMinApplied) return a.isMinApplied ? 1 : -1;
    return b.tipo - a.tipo;
  });

  // 2. Construir Cuadros de Liquidación y Líneas TXT por Zona para el rateBucket objetivo
  const targetNumericRate =
    targetRateBucket === '5.11' ? STANDARD_IEE_RATE : parseFloat(targetRateBucket);
  const rateFactor = targetNumericRate / 100.0;

  const zonesPresent = Array.from(new Set(facts.map(f => f.zona)));
  const cuadrosByZone: Record<string, ZoneCuadroLiquidacion> = {};

  for (const zona of zonesPresent) {
    const zoneFacts = facts.filter(f => f.zona === zona && f.rateBucket === targetRateBucket);
    if (zoneFacts.length === 0) continue;

    interface AggLine {
      regimen: string;
      meta: Regimen560Meta;
      isMinApplied: boolean;
      isNegative: boolean;
      baseImponible: number;
      cantidadMwh: number;
      nifDestinatario: string;
      cieDestinatario: string;
      tension: string;
      concepto: string;
      cuotaIntegra: number;
      cuotaMinima: number;
    }

    const lineMap = new Map<string, AggLine>();

    for (const f of zoneFacts) {
      let effectiveIsMin = f.isMinApplied;
      let cuotaIntegra = f.isMinApplied ? 0 : f.taxAmount;
      let cuotaMinima = f.isMinApplied ? f.taxAmount : 0;

      // En modo 'neteado' (contingencia AEAT ante error 39652 con mínimos negativos),
      // se compensan signos dentro del régimen y, en SBFO/SBFI, los mínimos se absorben en Cuota Íntegra.
      if (mode === 'neteado' && (f.regimen === 'SBFO' || f.regimen === 'SBFI') && f.isMinApplied) {
        effectiveIsMin = false;
        cuotaIntegra = f.taxAmount;
        cuotaMinima = 0;
      }

      const signKey = mode === 'neteado' ? 'NET' : f.isNegative ? 'NEG' : 'POS';
      const groupKey = f.meta.aggregateAll
        ? `${f.regimen}|${effectiveIsMin ? 'MIN' : 'PCT'}|${signKey}|${f.concepto}`
        : `${f.regimen}|${f.nifDestinatario}|${f.cieDestinatario}|${f.tension}|${f.concepto}|${effectiveIsMin ? 'MIN' : 'PCT'}|${signKey}`;

      if (!lineMap.has(groupKey)) {
        lineMap.set(groupKey, {
          regimen: f.regimen,
          meta: f.meta,
          isMinApplied: effectiveIsMin,
          isNegative: f.isNegative,
          baseImponible: 0,
          cantidadMwh: 0,
          nifDestinatario: f.nifDestinatario,
          cieDestinatario: f.cieDestinatario,
          tension: f.tension,
          concepto: f.concepto,
          cuotaIntegra: 0,
          cuotaMinima: 0,
        });
      }

      const agg = lineMap.get(groupKey)!;
      agg.baseImponible = round2(agg.baseImponible + f.subtotal);
      agg.cantidadMwh = round3(agg.cantidadMwh + f.energyMwh);
      agg.cuotaIntegra = round2(agg.cuotaIntegra + cuotaIntegra);
      agg.cuotaMinima = round2(agg.cuotaMinima + cuotaMinima);
    }

    // Filtrar líneas que en modo neteado hayan quedado completamente a 0
    const aggLines = Array.from(lineMap.values()).filter(
      l => l.baseImponible !== 0 || l.cantidadMwh !== 0 || l.cuotaIntegra !== 0 || l.cuotaMinima !== 0
    );

    // Ordenar: primero regímenes especiales (94.x, 98.x), luego SBFO, luego SBFI; positivos antes de negativos
    const orderScore = (l: AggLine) => {
      if (l.regimen.startsWith('94.')) return 10;
      if (l.regimen.startsWith('98.')) return 20;
      if (l.regimen === 'SBFO') return l.isMinApplied ? 35 : 30;
      if (l.regimen === 'SBFI') return l.isMinApplied ? 45 : 40;
      return 50;
    };
    aggLines.sort((a, b) => {
      const diff = orderScore(a) - orderScore(b);
      if (diff !== 0) return diff;
      if (a.isNegative !== b.isNegative) return a.isNegative ? 1 : -1;
      return a.nifDestinatario.localeCompare(b.nifDestinatario);
    });

    const computeLineRedAndLiq = (l: AggLine): { reduccion: number; baseLiquidable: number } => {
      if (l.meta.exempt) return { reduccion: 0, baseLiquidable: 0 };
      if (l.meta.reductionPct === 100) return { reduccion: l.baseImponible, baseLiquidable: 0 };
      if (l.meta.reductionPct === 85) {
        const red = round2(l.baseImponible * 0.85);
        return { reduccion: red, baseLiquidable: round2(l.baseImponible - red) };
      }
      return { reduccion: 0, baseLiquidable: l.isMinApplied ? 0 : l.baseImponible };
    };

    // Calcular Casillas antes de ajuste de céntimos
    let rawCasilla2 = 0;
    let casilla3 = 0;
    for (const l of aggLines) {
      if (!l.meta.exempt && !l.isMinApplied) {
        const { baseLiquidable } = computeLineRedAndLiq(l);
        rawCasilla2 = round2(rawCasilla2 + baseLiquidable);
        casilla3 = round2(casilla3 + l.cuotaIntegra);
      }
    }

    // Red de seguridad contra truncamiento/redondeo de AEAT (Errores 39641 / 39652)
    let centAdjustmentEur = 0;
    if (adjustCents && casilla3 !== 0) {
      const targetLine =
        aggLines.find(l => l.regimen === 'SBFO' && !l.isMinApplied && l.baseImponible > 0) ||
        aggLines.find(l => l.regimen === 'SBFI' && !l.isMinApplied && l.baseImponible > 0) ||
        aggLines.find(l => (l.regimen === 'SBFO' || l.regimen === 'SBFI') && !l.isMinApplied);

      if (targetLine) {
        const matchesBoth = (candBase2: number) =>
          trunc2(candBase2 * rateFactor) === casilla3 && round2(candBase2 * rateFactor) === casilla3;
        const matchesRound = (candBase2: number) => round2(candBase2 * rateFactor) === casilla3;

        if (!matchesBoth(rawCasilla2)) {
          let chosenDeltaCents: number | null = null;
          // Búsqueda en espiral 0, +1, -1, +2, -2... hasta ±2500 céntimos (±25 € de base = ±1.27 € de cuota)
          for (let step = 1; step <= 2500; step++) {
            for (const sign of [1, -1]) {
              const d = step * sign;
              const cand = round2(rawCasilla2 + d / 100.0);
              if (matchesBoth(cand)) {
                chosenDeltaCents = d;
                break;
              }
            }
            if (chosenDeltaCents !== null) break;
          }
          // Fallback si casilla3 es negativa y trunc2 difiere de round2
          if (chosenDeltaCents === null) {
            for (let step = 1; step <= 2500; step++) {
              for (const sign of [1, -1]) {
                const d = step * sign;
                const cand = round2(rawCasilla2 + d / 100.0);
                if (matchesRound(cand)) {
                  chosenDeltaCents = d;
                  break;
                }
              }
              if (chosenDeltaCents !== null) break;
            }
          }

          if (chosenDeltaCents !== null && chosenDeltaCents !== 0) {
            centAdjustmentEur = round2(chosenDeltaCents / 100.0);
            targetLine.baseImponible = round2(targetLine.baseImponible + centAdjustmentEur);
          }
        }
      }
    }

    // Recalcular Casillas definitivas (1) a (6) y construir las líneas TXT exactas (12 campos terminados en ;)
    let casilla1 = 0;
    let casilla2 = 0;
    let casilla3Final = 0;
    let casilla4 = 0;
    let casilla5 = 0;
    let exemptCantidadMwh = 0;
    let exemptBaseImponible = 0;
    const txtLines: string[] = [];

    for (const l of aggLines) {
      const { reduccion, baseLiquidable } = computeLineRedAndLiq(l);

      if (l.meta.exempt) {
        exemptBaseImponible = round2(exemptBaseImponible + l.baseImponible);
        exemptCantidadMwh = round3(exemptCantidadMwh + l.cantidadMwh);
      } else if (l.isMinApplied) {
        casilla4 = round3(casilla4 + l.cantidadMwh);
        casilla5 = round2(casilla5 + l.cuotaMinima);
      } else {
        casilla1 = round2(casilla1 + l.baseImponible);
        casilla2 = round2(casilla2 + baseLiquidable);
        casilla3Final = round2(casilla3Final + l.cuotaIntegra);
      }

      // Columnas según ANEXO TABLA (INST_CUMPL_560 pág. 10 y Desg560V2):
      // Las casillas marcadas como "NO" deben ir estrictamente vacías ("").
      const col1 = l.regimen;
      const col2 = effectiveDeclarantCie;
      const col3 = fmt2(l.baseImponible);
      const col4 = l.meta.reductionPct > 0 ? fmt2(reduccion) : '';
      const col5 = l.meta.exempt ? '' : fmt2(baseLiquidable);
      const col6 = fmt3(l.cantidadMwh);
      const col7 = l.meta.requiresNif ? l.nifDestinatario : '';
      const col8 = l.meta.requiresCie ? l.cieDestinatario : '';
      const col9 = l.regimen === 'SBFO' || l.regimen === 'SBFI' ? '' : l.tension;
      const col10 = l.concepto;
      const col11 = !l.meta.exempt && !l.isMinApplied ? fmt2(l.cuotaIntegra) : '';
      const col12 = !l.meta.exempt && l.isMinApplied ? fmt2(l.cuotaMinima) : '';

      txtLines.push(
        `${col1};${col2};${col3};${col4};${col5};${col6};${col7};${col8};${col9};${col10};${col11};${col12};`
      );
    }

    const casilla6 = round2(casilla3Final + casilla5);

    cuadrosByZone[zona] = {
      zona,
      rateBucket: targetRateBucket,
      numericRate: targetNumericRate,
      casilla1BaseImponible: casilla1,
      casilla2BaseLiquidable: casilla2,
      casilla3CuotaIntegra: casilla3Final,
      casilla4CantidadMwh: casilla4,
      casilla5CuotaMinima: casilla5,
      casilla6TotalIngresar: casilla6,
      exemptCantidadMwh,
      exemptBaseImponible,
      centAdjustmentEur,
      rawCasilla2BeforeAdjust: rawCasilla2,
      hasNegativeMinQuota: casilla5 < 0,
      invoiceCount: zoneFacts.length,
      txtLines,
    };
  }

  const historicalZones = Array.from(historicalMap.values());
  const historicalQuotesCount = historicalZones.reduce((acc, h) => acc + h.count, 0);
  if (historicalQuotesCount > 0) {
    warnings.push(
      `Se han detectado ${historicalQuotesCount} factura(s)/abono(s) con tipos históricos reducidos (${historicalZones
        .map(h => `${h.zona}: ${h.rateBucket}%`)
        .join(', ')}). Según las instrucciones de la AEAT, no pueden mezclarse con la autoliquidación del 5,11269632% y deben declararse por separado.`
    );
  }

  const cieErrors = Array.from(cieErrorsSet);

  return {
    summaryRows,
    cuadrosByZone,
    historicalQuotesCount,
    historicalZones,
    warnings,
    cieErrors,
    declarantCie: effectiveDeclarantCie,
    companyName,
  };
}

// ─── TASA MUNICIPAL: NORMALIZACIÓN Y CRUCE HÍBRIDO DE MUNICIPIOS ──────────────

const STOP_WORDS_MUNICIPIO = new Set([
  'DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'I', 'Y', 'E', 'O', 'A', 'AL', 'EN', 'L', 'D', 'S', 'LES', 'ELS', 'SA', 'SES', 'ES'
]);

const PROVINCE_ALIASES: Record<string, string> = {
  'ARABA': 'ALAVA',
  'ALAVA': 'ALAVA',
  'ARABA/ALAVA': 'ALAVA',
  'BIZKAIA': 'VIZCAYA',
  'VIZCAYA': 'VIZCAYA',
  'GIPUZKOA': 'GUIPUZCOA',
  'GUIPUZCOA': 'GUIPUZCOA',
  'OURENSE': 'ORENSE',
  'ORENSE': 'ORENSE',
  'ACORUNA': 'CORUNA',
  'LACORUNA': 'CORUNA',
  'CORUNA': 'CORUNA',
  'GIRONA': 'GERONA',
  'GERONA': 'GERONA',
  'LLEIDA': 'LERIDA',
  'LERIDA': 'LERIDA',
  'CASTELLO': 'CASTELLON',
  'CASTELLON': 'CASTELLON',
  'CASTELLONDELAPLANA': 'CASTELLON',
  'VALENCIA': 'VALENCIA',
  'ALACANT': 'ALICANTE',
  'ALICANTE': 'ALICANTE',
  'ILLESBALEARS': 'BALEARES',
  'ISLASBALEARES': 'BALEARES',
  'BALEARES': 'BALEARES',
  'BALEARS': 'BALEARES',
  'SANTACRUZDETENERIFE': 'TENERIFE',
  'SCTENERIFE': 'TENERIFE',
  'TENERIFE': 'TENERIFE',
  'LASPALMAS': 'LASPALMAS',
  'NAFARROA': 'NAVARRA',
  'NAVARRA': 'NAVARRA',
  'LARIOJA': 'RIOJA',
  'RIOJA': 'RIOJA',
};

export function normalizeAsciiUpper(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export function canonicalProvince(provRaw: string | null | undefined): string {
  const norm = normalizeAsciiUpper(provRaw);
  if (!norm) return '';
  // Si viene bilingüe con "/", probar la primera parte
  const parts = norm.split('/').map(p => p.replace(/[^A-Z]/g, ''));
  for (const p of parts) {
    if (PROVINCE_ALIASES[p]) return PROVINCE_ALIASES[p];
  }
  const compact = norm.replace(/[^A-Z]/g, '');
  return PROVINCE_ALIASES[compact] || compact;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function extractSignificantTokens(raw: string): string[] {
  // Eliminar apóstrofes pegados (L'HOSPITALET -> LHOSPITALET) para equipararlo con erratas tipo LOSPITALET
  const cleaned = normalizeAsciiUpper(raw).replace(/['’`´]/g, '');
  const rawTokens = cleaned.split(/[^A-Z0-9]+/).filter(Boolean);
  const sig = rawTokens.filter(t => !STOP_WORDS_MUNICIPIO.has(t));
  return sig.length > 0 ? sig : rawTokens;
}

function tokensFuzzyEqual(t1: string, t2: string): boolean {
  if (t1 === t2) return true;
  // Si la diferencia era el prefijo apostrofado L / D / S pegado (ej. HOSPITALET vs LHOSPITALET)
  if ((t1.length >= 5 || t2.length >= 5) && (/^[LDS]/.test(t1) || /^[LDS]/.test(t2))) {
    if (t1.substring(1) === t2 || t2.substring(1) === t1) return true;
  }
  const minLen = Math.min(t1.length, t2.length);
  const maxLen = Math.max(t1.length, t2.length);
  // Nombres cortos (<= 4 letras como MORA, VERA, VIC, IBI): prohibido tolerar erratas para evitar ZAMORA/TALAVERA
  if (minLen <= 4 || maxLen <= 4) return false;
  if (Math.abs(t1.length - t2.length) > 2) return false;

  const maxTypos = maxLen >= 7 ? 2 : 1;
  return levenshteinDistance(t1, t2) <= maxTypos;
}

function matchSingleVariant(candidateRaw: string, targetVariantRaw: string): boolean {
  const candNorm = normalizeAsciiUpper(candidateRaw).replace(/['’`´]/g, '');
  const targNorm = normalizeAsciiUpper(targetVariantRaw).replace(/['’`´]/g, '');
  if (!candNorm || !targNorm) return false;
  if (candNorm === targNorm) return true;

  const candTokens = extractSignificantTokens(candidateRaw);
  const targTokens = extractSignificantTokens(targetVariantRaw);
  if (candTokens.length === 0 || targTokens.length === 0) return false;

  // Regla 1: TODAS las palabras significativas de la ciudad candidata deben encajar en el municipio buscado
  // (Impide que "SAN SEBASTIAN DE LOS REYES" encaje en "SAN SEBASTIAN", o "HOSPITALET DE LLOBREGAT" en "HOSPITALET DE L'INFANT")
  const allCandInTarget = candTokens.every(ct => targTokens.some(tt => tokensFuzzyEqual(ct, tt)));
  if (!allCandInTarget) return false;

  // Regla 2: TODAS las palabras del municipio buscado deben encajar en la ciudad candidata,
  // SALVO que el municipio oficial buscado sea compuesto ("VANDELLOS I L'HOSPITALET DE L'INFANT")
  const allTargetInCand = targTokens.every(tt => candTokens.some(ct => tokensFuzzyEqual(ct, tt)));
  if (allTargetInCand) return true;

  const isCompoundOfficial =
    /\b(I|Y)\b/.test(normalizeAsciiUpper(targetVariantRaw)) ||
    (targTokens.length >= 3 && candTokens.length >= 2);

  return isCompoundOfficial;
}

/**
 * Determina si una factura/suministro pertenece al municipio seleccionado (con soporte de provincia y nombres bilingües INE).
 */
export function matchesMunicipality(
  candidateCityRaw: string | null | undefined,
  candidateProvinceRaw: string | null | undefined,
  selectedQuery: string
): boolean {
  if (!candidateCityRaw || !selectedQuery) return false;

  const parts = selectedQuery.split(' -- ').map(s => s.trim());
  const muniPart = parts[0] || '';
  const selectedProvPart = parts[1] || '';

  if (selectedProvPart && candidateProvinceRaw) {
    const cProv = canonicalProvince(candidateProvinceRaw);
    const sProv = canonicalProvince(selectedProvPart);
    if (cProv && sProv && cProv !== sProv) {
      return false;
    }
  }

  // Soportar nombres oficiales bilingües INE separados por "/" (ej. "DONOSTIA / SAN SEBASTIÁN", "ELX / ELCHE")
  const variants = muniPart
    .split('/')
    .map(v => v.trim())
    .filter(Boolean);

  if (variants.some(variant => matchSingleVariant(candidateCityRaw, variant))) {
    return true;
  }

  return matchSingleVariant(candidateCityRaw, muniPart);
}
