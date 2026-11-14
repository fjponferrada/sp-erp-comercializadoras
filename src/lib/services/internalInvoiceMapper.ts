import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { normalizeCnmcLabelConfig } from '@/lib/cnmcLabelConfig';
import { normalizeSpanishPostalCodeOrNull, pickSpanishPostalCode } from '@/lib/postalCode';
import type {
  BillingCalculationResult,
  ConceptoRepercutibleItem,
  SvaDetailItem,
  TaxBreakdownItem,
} from '@/lib/services/InternalBillingEngine';

/**
 * Indica si el Motor de Facturación Interna opera como facturador oficial en producción
 * (`ENABLE_INTERNAL_BILLING_PRODUCTION === 'true'`).
 *
 * Mientras esté en `false` (por defecto, Fase de Pruebas / Shadow Billing conviviendo con Ingebau):
 * - Confirmar borradores en `/facturacion/interna` los confina 100% en `InternalInvoice` (`/facturas-internas`)
 *   sin promocionarlos a la tabla maestra `Invoice` (`/facturas`, Modelo 560, Tasa Municipal, Portal Cliente).
 * - Los módulos de negocio y regulatorios (Liquidación de Comisiones, Energía Pendiente, CNMC Coberturas,
 *   MITECO DAFNE y ESCILA) ignoran `InternalInvoice` para que las pruebas nunca dupliquen ni alteren los
 *   datos oficiales importados desde Ingebau.
 */
export function isInternalBillingProductionEnabled(): boolean {
  return process.env.ENABLE_INTERNAL_BILLING_PRODUCTION === 'true';
}

export interface MonthlyConsumptionBar {
  yearMonth: string; // YYYY-MM
  label: string; // ej. 'Ago 26'
  kwh: number;
  isCurrent?: boolean;
}

export interface EnergyOriginRow {
  source: string;
  companyPct: number;
  nationalPct: number;
  color: string;
}

export interface EnvironmentalImpactData {
  labelYear: number;
  is100RenewableGdo?: boolean;
  nationalAvgLetter?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  co2Letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  co2CompanyGPerKwh: number;
  co2NationalGPerKwh: number;
  radLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  radCompanyUgPerKwh: number;
  radNationalUgPerKwh: number;
}

export interface RectifiedInvoiceInfo {
  originalInvoiceNumber: string;
  originalIssueDate?: Date | string | null;
  originalTotalAmount?: number | null;
  deltaAmount?: number | null;
  f1OriginCode?: string;
  legalNoteText: string;
}

export interface InvoiceTemplateData {
  invoiceNumber: string;
  invoiceType?: string;
  issueDate: Date | string;
  paymentDate?: Date | string | null;
  billingStart?: Date | string | null;
  billingEnd?: Date | string | null;
  billingDays?: number;

  // Datos de la comercializadora / marca
  companyName: string;
  companyCif: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  companyWeb: string;
  companyOrdenCnmc: string;
  companyRegistroMercantil: string;
  companyVerticalLegalText: string;
  logoUrl: string | null;
  accentColor: string;
  brandPrimaryColor: string;

  // Datos del cliente y cobro
  clientName: string;
  clientNif: string;
  clientAddress: string;
  ibanMasked: string;
  paymentMethod: string;
  paymentMethodType: 'RECIBO' | 'TRANSFERENCIA';
  sepaMandateRef: string;
  companyBankIban?: string;
  companyBankName?: string;

  // Datos del suministro y contrato
  cups: string;
  supplyAddress: string;
  supplyPostalCode: string;
  tariff: string;
  cargoSegment: string;
  cnae: string;
  meterSerialNumber: string;
  distributorName: string;
  distributorPhone: string;
  accessContractRef: string;
  supplyContractRef: string;
  f1FiscalCode: string;
  productName: string;
  pricingModality: string;
  isFixed: boolean;
  contractEndDate?: Date | string | null;
  isAutoRenewal: boolean;
  hasPermanence: boolean;
  permanenceEndDate?: Date | string | null;
  contractedPowers: Record<string, number>;

  // Importes principales
  totalMWh: number;
  subtotal1: number;
  taxType: 'IVA' | 'IGIC' | 'IPSI';
  taxPercentage: number;
  taxAmount: number;
  taxBreakdown: TaxBreakdownItem[];
  totalSinDescuentoBolsillo: number;
  totalAmount: number;

  // Desgloses detallados
  energyCost: number;
  powerCost: number;
  alquilerEquipo: number;
  bonoSocial: number;
  bonoSocialDailyRate: number;
  bonoSocialLabel?: string;
  baseIEE: number;
  ieeRate: number;
  ieeReductionPct: number;
  taxElectric: number;
  feeCost: number;
  peajesDistribuidora: number;
  cargosDistribuidora: number;

  powerDetails: any[];
  energyAtrDetails: any[];
  energyMarketDetails: any[];
  reactiveEnergyCost: number;
  reactiveDetails: any[];
  capacitiveEnergyCost: number;
  excesosPotencia: number;
  penalizacionNoIcpCost: number;
  recargoInfAnioCost: number;
  interesesDemoraCost: number;

  conceptosRepercutibles: ConceptoRepercutibleItem[];
  conceptosRepercutiblesBase: number;
  conceptosRepercutiblesExempt: number;

  // Autoconsumo y Bolsillo Solar
  excedentesAutoconsumo: number;
  excedentesKwh: number;
  pexc?: number | null;
  maxExcedentes: number;
  hasBolsilloSolar: boolean;
  cgBolsilloSolarCost: number;
  cgBolsilloSolarDailyRate: number;
  bolsilloSolarSaldoInicial: number;
  bolsilloSolarLlenado: number;
  bolsilloSolarUso: number;
  bolsilloSolarSaldoFinal: number;

  // SVA y lecturas enriquecidas
  svaCost: number;
  svaConcept?: string;
  svaDetails: SvaDetailItem[];
  f1Readings?: any;
  isOtrasFacturas?: boolean;

  // Información histórica, regulatoria, etiqueta CNMC y QR oficial (Circular 2/2021, BOE-A-2022-16989, RD 88/2026)
  consumptionHistory: MonthlyConsumptionBar[];
  annualTotalKwh: number;
  annualConsumptionByPeriod: Record<string, number>;
  dailyAvgKwh: number;
  dailyAvgEur: number;
  prevYearSameMonthKwh?: number | null;
  postalCodeAvgKwh?: number | null;
  maxDemandedPowers12m: Record<string, number>;
  powerControlMode: 'ICP' | 'Maxímetro';

  rectifiedInfo?: RectifiedInvoiceInfo | null;
  boeLegalText: string;
  indexedFormulaNote?: string;
  f1DistributorComments?: string;

  energyOriginMix: EnergyOriginRow[];
  environmentalImpact: EnvironmentalImpactData;

  showCnmcQr: boolean;
  cnmcQrUrl?: string;
  cnmcQrSvgPath?: string;
  cnmcQrModuleCount?: number;
}

// Caché en memoria para logos remotos convertidos a Data URI (evita latencia de red por página en @react-pdf)
const logoDataUriCache = new Map<string, { dataUri: string | null; expiresAt: number }>();

async function resolveLogoDataUri(url?: string | null): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) return trimmed;

  const now = Date.now();
  const cached = logoDataUriCache.get(trimmed);
  if (cached && cached.expiresAt > now) {
    return cached.dataUri;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(trimmed, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) {
      logoDataUriCache.set(trimmed, { dataUri: null, expiresAt: now + 5 * 60 * 1000 });
      return null;
    }

    const ctype = (resp.headers.get('content-type') || '').toLowerCase();
    let mime = 'image/jpeg';
    if (ctype.includes('png') || trimmed.toLowerCase().endsWith('.png')) {
      mime = 'image/png';
    } else if (ctype.includes('jpeg') || ctype.includes('jpg') || /\.jpe?g$/i.test(trimmed)) {
      mime = 'image/jpeg';
    } else {
      logoDataUriCache.set(trimmed, { dataUri: null, expiresAt: now + 10 * 60 * 1000 });
      return null;
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0) return null;
    const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
    logoDataUriCache.set(trimmed, { dataUri, expiresAt: now + 60 * 60 * 1000 });
    return dataUri;
  } catch {
    logoDataUriCache.set(trimmed, { dataUri: null, expiresAt: now + 2 * 60 * 1000 });
    return null;
  }
}

function mapCnmcProcedenciaCode(codeRaw: any): string {
  if (codeRaw === undefined || codeRaw === null || codeRaw === '') return '';
  const code = String(Array.isArray(codeRaw) ? codeRaw[0] : codeRaw).trim();
  switch (code) {
    case '10':
    case '01':
      return 'Real';
    case '20':
      return 'Telegestión';
    case '30':
    case '31':
      return 'Telemedida';
    case '40':
    case '60':
      return 'Estimada';
    case '50':
      return 'Autolectura';
    case '70':
      return 'Sin lectura';
    case '99':
      return 'Rectificación';
    default:
      return '';
  }
}

function parseLooseNum(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  const raw = Array.isArray(val) ? val[0] : val;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const n = parseFloat(String(raw).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function shiftIsoDateDays(isoDate: string, deltaDays: number): string {
  const clean = isoDate.trim().substring(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return clean;
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().substring(0, 10);
}

function formatEsNum(n: number, dec = 2): string {
  if (!Number.isFinite(n)) return '0,00';
  const fixed = n.toFixed(dec);
  const [intPart, decPart] = fixed.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart !== undefined ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
}

function deduceCargoSegment(tariff: string): string {
  const t = (tariff || '').toUpperCase().trim();
  if (t.includes('VE')) return 'VE';
  if (t.includes('2.0')) return '1';
  if (t.includes('3.0')) return '2';
  if (t.includes('6.1')) return '3';
  if (t.includes('6.2')) return '4';
  if (t.includes('6.3')) return '5';
  if (t.includes('6.4')) return '6';
  return '1';
}

function buildQrSvgPath(url: string): { path: string; size: number } | null {
  try {
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const parts: string[] = [];

    for (let y = 0; y < size; y++) {
      let x = 0;
      while (x < size) {
        if (data[y * size + x]) {
          let run = 1;
          while (x + run < size && data[y * size + x + run]) {
            run++;
          }
          parts.push(`M${x},${y}h${run}v1h-${run}z`);
          x += run;
        } else {
          x++;
        }
      }
    }
    return { path: parts.join(''), size };
  } catch {
    return null;
  }
}

/**
 * Deduce la tipología comercial de factura interna según el código TipoFactura CNMC (Tabla 102).
 */
export function deduceInvoiceType(f1JsonData: any): string {
  const f1Data =
    f1JsonData?.FacturaATR ||
    f1JsonData?.OtrasFacturas ||
    f1JsonData?.Facturas?.FacturaATR ||
    f1JsonData?.Facturas?.OtrasFacturas ||
    f1JsonData ||
    {};

  const dgf =
    f1Data?.DatosGeneralesFacturaATR?.DatosGeneralesFactura ||
    f1Data?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura ||
    f1Data?.DatosGeneralesFactura;

  const tipoCode = String(dgf?.TipoFactura || 'N').trim().toUpperCase();
  if (tipoCode === 'R') return 'Rectificadora';
  if (tipoCode === 'A' || tipoCode === 'AR' || tipoCode === 'S') return 'Abono';
  if (tipoCode === 'C') return 'Complementaria';
  if (tipoCode === 'G') return 'Regularizadora';
  return 'Normal';
}

/**
 * Formatea una fecha a YYYY-MM-DD en huso horario peninsular Europe/Madrid.
 */
export function toMadridIsoDate(dateInput?: Date | string | null): string {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
}

/**
 * Devuelve un Date ajustado -12h cuando end > start para mostrar el último día natural facturado (inclusive),
 * respetando que en BD fechaFin se almacena desplazada +1 día a las 00:00 Europe/Madrid (Regla 170).
 */
export function getInclusiveEndDate(
  startInput?: Date | string | null,
  endInput?: Date | string | null
): Date | null {
  if (!endInput) return null;
  const end = endInput instanceof Date ? endInput : new Date(endInput);
  if (isNaN(end.getTime())) return null;

  if (startInput) {
    const start = startInput instanceof Date ? startInput : new Date(startInput);
    if (!isNaN(start.getTime()) && end.getTime() - start.getTime() >= 20 * 3600 * 1000) {
      return new Date(end.getTime() - 12 * 3600 * 1000);
    }
  }
  return end;
}

export function formatMadridDateEs(dateInput?: Date | string | null): string {
  if (!dateInput) return '-';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const iso = toMadridIsoDate(d);
  if (iso && iso.length === 10) {
    const [y, m, day] = iso.split('-');
    return `${day}/${m}/${y}`;
  }
  return d.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
}

export function formatMadridInclusiveEndEs(
  startInput?: Date | string | null,
  endInput?: Date | string | null
): string {
  const inclusive = getInclusiveEndDate(startInput, endInput);
  return inclusive ? formatMadridDateEs(inclusive) : '-';
}

export function maskIban(iban?: string | null): string {
  if (!iban) return 'Domiciliación bancaria';
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  if (clean.length < 10) return clean;
  const prefix = clean.slice(0, 8);
  const suffix = clean.slice(-5);
  return `${prefix}***********${suffix}`;
}

/**
 * Construye el payload JSON persistido en InternalInvoice.invoiceData de forma uniforme
 * para calculate, recalculate y repair (excluyendo hourlyDetails para no inflar JSONB).
 */
export function buildInternalInvoiceJsonData(
  result: BillingCalculationResult,
  contract?: any,
  markManualRepair = false
): Record<string, any> {
  const isRepaired = Boolean(markManualRepair || result.repairData);
  return {
    repaired: isRepaired,
    repairedAt: isRepaired ? new Date().toISOString() : undefined,
    pricingModel: contract?.pricingModel ?? (result.isFixed ? 'FIXED' : 'INDEXED'),
    isFixed: result.isFixed ?? false,
    isOtrasFacturas: result.isOtrasFacturas ?? false,
    billingDays: result.billingDays ?? 0,
    feeApplied: result.feeApplied ?? contract?.fee ?? null,
    assumedConsumption: result.totalF1MWh,
    totalCchMWh: result.totalCchMWh,
    totalF1MWh: result.totalF1MWh,

    // Costes de energía, potencia y peajes/cargos
    energyCost: result.energyCost,
    feeCost: result.feeCost,
    capacityCost: result.capacityCost,
    fneeCost: result.fneeCost,
    powerCost: result.powerCost,
    peajesDistribuidora: result.peajesDistribuidora,
    cargosDistribuidora: result.cargosDistribuidora,

    // Regulados e impuestos
    alquilerEquipo: result.alquilerEquipo ?? 0,
    bonoSocial: result.bonoSocial ?? 0,
    bonoSocialDailyRate: result.bonoSocialDailyRate ?? 0,
    bonoSocialLabel: result.bonoSocialLabel,
    baseIEE: result.baseIEE ?? 0,
    ieeRate: result.ieeRate ?? 5.11269632,
    ieeReductionPct: result.ieeReductionPct ?? 0,
    taxElectric: result.taxElectric ?? 0,

    // Impuestos indirectos territoriales
    taxType: result.taxType ?? 'IVA',
    taxPercentage: result.taxPercentage ?? 21,
    taxBreakdown: result.taxBreakdown ?? [],
    totalSinDescuentoBolsillo: result.totalSinDescuentoBolsillo ?? result.totalAmount,

    // Excesos, reactiva/capacitiva, penalizaciones y conceptos repercutibles
    excesosPotencia: result.excesosPotencia ?? 0,
    reactiveEnergyCost: result.reactiveEnergyCost ?? 0,
    reactiveDetails: result.reactiveDetails ?? [],
    capacitiveEnergyCost: result.capacitiveEnergyCost ?? 0,
    penalizacionNoIcpCost: result.penalizacionNoIcpCost ?? 0,
    recargoInfAnioCost: result.recargoInfAnioCost ?? 0,
    interesesDemoraCost: result.interesesDemoraCost ?? 0,
    conceptosRepercutibles: result.conceptosRepercutibles ?? [],
    conceptosRepercutiblesBase: result.conceptosRepercutiblesBase ?? 0,
    conceptosRepercutiblesExempt: result.conceptosRepercutiblesExempt ?? 0,

    // Autoconsumo y Bolsillo Solar
    excedentesAutoconsumo: result.excedentesAutoconsumo ?? 0,
    excedentesKwh: result.excedentesKwh ?? 0,
    pexc: result.pexc ?? null,
    maxExcedentes: result.maxExcedentes ?? 0,
    hasBolsilloSolar: result.hasBolsilloSolar ?? false,
    cgBolsilloSolarCost: result.cgBolsilloSolarCost ?? 0,
    cgBolsilloSolarDailyRate: result.cgBolsilloSolarDailyRate ?? 0,
    bolsilloSolarSaldoInicial: result.bolsilloSolarSaldoInicial ?? 0,
    bolsilloSolarLlenado: result.bolsilloSolarLlenado ?? 0,
    bolsilloSolarUso: result.bolsilloSolarUso ?? 0,
    bolsilloSolarSaldoFinal: result.bolsilloSolarSaldoFinal ?? 0,

    // SVA
    svaCost: result.svaCost ?? 0,
    svaConcept: result.svaConcept,
    svaDetails: result.svaDetails ?? [],

    // Tablas detalladas por periodo y lecturas
    periods: result.periods ?? {},
    powerDetails: result.powerDetails ?? [],
    energyAtrDetails: result.energyAtrDetails ?? [],
    energyMarketDetails: result.energyMarketDetails ?? [],
    f1Readings: result.f1Readings ?? null,
    meterSerialNumber: result.meterSerialNumber ?? '',

    // Márgenes internos
    energyMargin: result.energyMargin ?? 0,
    powerMargin: result.powerMargin ?? 0,
  };
}

/**
 * Enriquecimiento retrocompatible de f1Readings desde el JSON del F1 cuando el borrador fue calculado
 * antes de persistir fechas de lectura, procedencias CNMC Tabla 41 o InformacionAlConsumidor.
 */
function enrichF1ReadingsFromXml(existingReadings: any, f1Node: any, tariff: string): any {
  const base: Record<string, any> = existingReadings ? JSON.parse(JSON.stringify(existingReadings)) : {};
  for (let i = 1; i <= 6; i++) {
    const pKey = `P${i}`;
    if (!base[pKey]) {
      base[pKey] = {
        actIni: '-',
        actFin: '-',
        reactIni: '-',
        reactFin: '-',
        reactCons: 0,
        actCons: 0,
        billedActCons: 0,
        max: 0,
        fechaDesde: '',
        fechaHasta: '',
        procIni: '',
        procFin: '',
        constMult: 1,
      };
    }
  }

  if (!f1Node || typeof f1Node !== 'object') return base;

  const getArr = (v: any): any[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

  const modoCtrl = f1Node?.DatosGeneralesFacturaATR?.DatosFacturaATR?.ModoControlPotencia;
  if (modoCtrl !== undefined && modoCtrl !== null && !base.ModoControlPotencia) {
    base.ModoControlPotencia = Number(modoCtrl) || 0;
  }

  const medidasList = getArr(f1Node?.Medidas);
  for (const med of medidasList) {
    for (const mod of getArr(med?.ModeloAparato)) {
      if (!base.NumeroSerie && mod?.NumeroSerie !== undefined && mod?.NumeroSerie !== null) {
        base.NumeroSerie = String(mod.NumeroSerie).trim();
      }
      for (const intg of getArr(mod?.Integrador)) {
        const mag = String(intg?.Magnitud || '');
        const cod = String(intg?.CodigoPeriodo || '');
        const lastChar = cod.slice(-1);
        if (!['1', '2', '3', '4', '5', '6'].includes(lastChar)) continue;
        const pName = `P${lastChar}`;
        const slot = base[pName];
        if (!slot) continue;

        const lDesdeNode = intg?.LecturaDesde ?? intg?.lecturaDesde;
        const lHastaNode = intg?.LecturaHasta ?? intg?.lecturaHasta;
        const lDesde = lDesdeNode?.Lectura ?? lDesdeNode?.lectura;
        const lHasta = lHastaNode?.Lectura ?? lHastaNode?.lectura;
        const consCalc = intg?.ConsumoCalculado ?? intg?.consumoCalculado;
        const fDesde = lDesdeNode?.Fecha ?? lDesdeNode?.fecha;
        const fHasta = lHastaNode?.Fecha ?? lHastaNode?.fecha;
        const pIniRaw = lDesdeNode?.Procedencia ?? lDesdeNode?.procedencia;
        const pFinRaw = lHastaNode?.Procedencia ?? lHastaNode?.procedencia;
        const cMult = parseLooseNum(intg?.ConstanteMultiplicadora ?? intg?.constanteMultiplicadora);

        if (mag === 'AE' || mag === '1') {
          if (lDesde !== undefined && (slot.actIni === '-' || slot.actIni === undefined)) {
            slot.actIni = String(lDesde);
          }
          if (lHasta !== undefined && (slot.actFin === '-' || slot.actFin === undefined)) {
            slot.actFin = String(lHasta);
          }
          if (fDesde && !slot.fechaDesde) slot.fechaDesde = String(fDesde).trim().substring(0, 10);
          if (fHasta && !slot.fechaHasta) slot.fechaHasta = String(fHasta).trim().substring(0, 10);
          if (pIniRaw !== undefined && !slot.procIni) slot.procIni = mapCnmcProcedenciaCode(pIniRaw);
          if (pFinRaw !== undefined && !slot.procFin) slot.procFin = mapCnmcProcedenciaCode(pFinRaw);
          if (cMult > 0) slot.constMult = cMult;
          if (consCalc !== undefined && !slot.actCons) {
            slot.actCons = Math.abs(parseLooseNum(consCalc));
          }
        } else if (mag === 'R1' || mag === '2') {
          if (lDesde !== undefined && (slot.reactIni === '-' || slot.reactIni === undefined)) {
            slot.reactIni = String(lDesde);
          }
          if (lHasta !== undefined && (slot.reactFin === '-' || slot.reactFin === undefined)) {
            slot.reactFin = String(lHasta);
          }
          if (pFinRaw !== undefined && !slot.procFin) slot.procFin = mapCnmcProcedenciaCode(pFinRaw);
          if (consCalc !== undefined && !slot.reactCons) {
            slot.reactCons = Math.abs(parseLooseNum(consCalc));
          }
        } else if (mag === 'PM' || mag === '3') {
          let val = consCalc !== undefined ? Math.abs(parseLooseNum(consCalc)) : Math.abs(parseLooseNum(lHasta));
          if (val > 1000) val = val / 1000.0;
          if (val > 0 && (!slot.max || val > slot.max)) {
            slot.max = val;
          }
        }
      }
    }
  }

  if (!base.InfoConsumidor && f1Node?.InformacionAlConsumidor) {
    const ic = f1Node.InformacionAlConsumidor;
    const maxAnualByPeriod: Record<string, number> = {};
    const pArr = getArr(ic.Periodo);
    for (let idx = 0; idx < pArr.length && idx < 6; idx++) {
      const item = pArr[idx];
      const pKey = item?.Periodo || `P${idx + 1}`;
      let rawVal = Math.abs(
        parseLooseNum(item?.PotenciaMaxDemandadaAnioMovil ?? item?.PotenciaMaximaDemandadaAnioMovil)
      );
      if (rawVal > 0) {
        if ((tariff || '').includes('2.0') && rawVal > 50) rawVal = rawVal / 1000.0;
        else if (rawVal > 1000) rawVal = rawVal / 1000.0;
        maxAnualByPeriod[pKey] = rawVal;
      }
    }
    const mediaCp = parseLooseNum(ic.ValorEnergiaMediaCP);
    base.InfoConsumidor = {
      maxAnualByPeriod,
      valorEnergiaMediaCP: mediaCp > 0 ? mediaCp : null,
    };
  }

  return base;
}

const MONTH_SHORT_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

function formatYearMonthLabelEs(ym: string): string {
  const [yStr, mStr] = ym.split('-');
  const mIdx = (parseInt(mStr, 10) || 1) - 1;
  return `${MONTH_SHORT_ES[mIdx] || mStr} ${yStr.slice(-2)}`;
}

/**
 * Construye los datos enriquecidos de plantilla (PDF y XML) para cualquier InternalInvoice,
 * garantizando total paridad entre la vista previa proforma y la emisión definitiva.
 */
export async function buildInvoiceTemplateData(invoice: any): Promise<InvoiceTemplateData> {
  const idata = (invoice.invoiceData || {}) as Record<string, any>;
  const client = invoice.client || invoice.contract?.client;
  let contract = invoice.contract;
  if (contract && !contract.product && contract.productId) {
    const prod = await prisma.product.findUnique({ where: { id: contract.productId } });
    contract = { ...contract, product: prod };
  }

  const supplyPoint = invoice.supplyPoint || contract?.supplyPoint || invoice.f1Invoice?.supplyPoint;
  let brand = contract?.brand || client?.brand || null;
  if (!brand && (contract?.brandId || client?.brandId)) {
    brand = await prisma.brand.findUnique({
      where: { id: contract?.brandId || client?.brandId },
      include: { company: true },
    });
  }
  let company = invoice.company || brand?.company || null;
  if (
    company?.id &&
    company.etiquetaCnmc === undefined &&
    company.registroMercantil === undefined
  ) {
    company = await prisma.company.findUnique({
      where: { id: company.id },
    });
  } else if (!company && (invoice.companyId || brand?.companyId)) {
    company = await prisma.company.findUnique({
      where: { id: invoice.companyId || brand?.companyId },
    });
  }
  let f1 = invoice.f1Invoice;
  if (!f1 && invoice.f1InvoiceId) {
    f1 = await prisma.f1Invoice.findUnique({ where: { id: invoice.f1InvoiceId } });
  }

  // Extraer nodos clave del XML/JSON del F1
  const f1Raw = f1?.jsonData as any;
  const f1Node =
    f1Raw?.FacturaATR ||
    f1Raw?.OtrasFacturas ||
    f1Raw?.Facturas?.FacturaATR ||
    f1Raw?.Facturas?.OtrasFacturas ||
    f1Raw ||
    {};
  const dGen =
    f1Node?.DatosGeneralesFacturaATR?.DatosGeneralesFactura ||
    f1Node?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura ||
    f1Node?.DatosGeneralesFactura ||
    {};

  // Buscar distribuidora por código REE (columna explícita -> [0031] -> Cabecera XML -> prefijo CUPS)
  let distributorRecord: { name: string; phone: string | null } | null = null;
  const bracketReeMatch = String(supplyPoint?.distributor || '').match(/\[(\d{3,4})\]/);
  const xmlEmisoraRee =
    f1Raw?.Cabecera?.CodigoREEEmpresaEmisora ??
    f1Raw?.MensajeFacturacion?.Cabecera?.CodigoREEEmpresaEmisora ??
    null;
  const cupsReePrefix =
    supplyPoint?.cups && /^ES\d{4}/i.test(String(supplyPoint.cups).trim())
      ? String(supplyPoint.cups).trim().slice(2, 6)
      : null;

  const rawReeCandidate =
    supplyPoint?.distributorReeCode ||
    (bracketReeMatch ? bracketReeMatch[1] : null) ||
    xmlEmisoraRee ||
    cupsReePrefix;
  const reeCode = rawReeCandidate ? String(rawReeCandidate).trim().padStart(4, '0') : null;

  if (reeCode) {
    distributorRecord = await prisma.distributor.findFirst({
      where: {
        OR: [
          { reeCode },
          ...(rawReeCandidate ? [{ reeCode: String(rawReeCandidate).trim() }] : []),
        ],
      },
      select: { name: true, phone: true },
    });
  }

  const KNOWN_DIST_PHONES: Record<string, string> = {
    '0031': '900 850 840', // EDISTRIBUCION REDES DIGITALES (Endesa)
    '0024': '900 850 840',
    '0021': '900 171 171', // I-DE REDES ELÉCTRICAS INTELIGENTES (Iberdrola)
    '0022': '900 333 999', // UFD DISTRIBUCIÓN ELECTRICIDAD (Naturgy / Unión Fenosa)
    '0026': '900 907 001', // E-REDES / HIDROCANTÁBRICO DISTRIBUCIÓN
    '0027': '900 101 051', // VIESGO DISTRIBUCIÓN ELÉCTRICA
  };
  const rawDistPhone =
    (distributorRecord?.phone && String(distributorRecord.phone).trim()) ||
    (reeCode && KNOWN_DIST_PHONES[reeCode]) ||
    '';
  const cleanDigitsPhone = rawDistPhone.replace(/\s+/g, '');
  const formattedDistPhone =
    /^\d{9}$/.test(cleanDigitsPhone)
      ? `${cleanDigitsPhone.slice(0, 3)} ${cleanDigitsPhone.slice(3, 6)} ${cleanDigitsPhone.slice(6)}`
      : rawDistPhone;

  // Ref. Contrato Acceso ATR: CodContrato es la etiqueta oficial CNMC Facturacion.xsd
  const rawAccessContractRef =
    f1Node?.DatosGeneralesFacturaATR?.CodContrato ??
    f1Node?.DatosGeneralesOtrasFacturas?.CodContrato ??
    f1Node?.DatosGeneralesFacturaATR?.Contrato?.CodigoContrato ??
    f1Node?.DatosGeneralesFacturaATR?.DatosFacturaATR?.CodigoContrato ??
    dGen?.CodigoContrato ??
    (contract?.airtableData as any)?.['Contrato Acceso'] ??
    '-';
  const accessContractRef =
    String(rawAccessContractRef)
      .replace(/^CC\s+/i, '')
      .trim() || '-';

  const f1FiscalCodeRaw =
    dGen?.CodigoFiscalFactura || (f1?.numeroFactura ? String(f1.numeroFactura) : '');
  const f1FiscalCode = String(f1FiscalCodeRaw).replace(/^CF\s+/i, '').trim() || '-';

  // Nombre completo del titular
  const fullPersonName = [client?.firstName, client?.lastName, client?.lastName2]
    .filter(Boolean)
    .join(' ')
    .trim();
  const clientName = client?.businessName || fullPersonName || 'Cliente Desconocido';

  // Dirección fiscal del cliente vs dirección física del suministro
  const f1PostalCode = normalizeSpanishPostalCodeOrNull(
    f1Node?.DatosGeneralesFacturaATR?.DireccionSuministro?.CodPostal
  );
  const supplyPostalCode =
    pickSpanishPostalCode(supplyPoint?.postalCode, supplyPoint?.sipsPostalCode) ||
    f1PostalCode ||
    normalizeSpanishPostalCodeOrNull(client?.billingPostalCode) ||
    '';

  const supplyAddress = [
    supplyPoint?.address,
    supplyPostalCode || null,
    supplyPoint?.city,
    supplyPoint?.province ? `(${supplyPoint.province})` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const billingAddressParts = [
    client?.billingAddress,
    normalizeSpanishPostalCodeOrNull(client?.billingPostalCode),
    client?.billingCity,
    client?.billingProvince ? `(${client.billingProvince})` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const clientAddress = billingAddressParts || supplyAddress || '-';

  const tariff = supplyPoint?.tariff || contract?.product?.tariff || '2.0TD';
  const cargoSegment = deduceCargoSegment(tariff);

  // Potencias contratadas por periodo (kW)
  const contractedPowers: Record<string, number> = {};
  for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
    const key = `${p.toLowerCase()}c`;
    const val = contract?.[key] ?? supplyPoint?.[key] ?? supplyPoint?.[`sips${p}c`];
    if (typeof val === 'number' && !isNaN(val) && val > 0) {
      contractedPowers[p] = val;
    }
  }
  if (Object.keys(contractedPowers).length === 0 && Array.isArray(idata.powerDetails)) {
    for (const pd of idata.powerDetails) {
      if (pd?.period && typeof pd.kw === 'number' && pd.kw > 0) {
        contractedPowers[pd.period] = pd.kw;
      }
    }
  }

  // Días de facturación
  let billingDays = Number(idata.billingDays || 0);
  if (!billingDays && Array.isArray(idata.powerDetails) && idata.powerDetails[0]?.days) {
    billingDays = Math.round(Number(idata.powerDetails[0].days));
  }
  if (!billingDays && invoice.billingStart && invoice.billingEnd) {
    const ms = new Date(invoice.billingEnd).getTime() - new Date(invoice.billingStart).getTime();
    billingDays = Math.max(1, Math.round(ms / (1000 * 3600 * 24)));
  }
  if (!billingDays) billingDays = 30;

  const issueDateObj = invoice.issueDate ? new Date(invoice.issueDate) : new Date();
  const inclusiveEndDateObj =
    getInclusiveEndDate(invoice.billingStart, invoice.billingEnd) || issueDateObj;

  // Modalidad de producto y renovación contractual
  const airData =
    contract?.airtableData && typeof contract.airtableData === 'object'
      ? (contract.airtableData as Record<string, any>)
      : {};
  const pmUpper = String(contract?.pricingModel || idata.pricingModel || '').toUpperCase();
  const prodTypeLower = String(contract?.product?.type || '').toLowerCase();
  const prodNameRaw = String(contract?.product?.name || airData['Producto'] || '').trim();
  const isFixed =
    idata.isFixed !== undefined
      ? Boolean(idata.isFixed)
      : pmUpper === 'FIJO' || pmUpper === 'FIXED' || prodTypeLower.includes('fijo');
  const pricingModality = isFixed ? 'Precio Fijo' : 'Indexado Pass-Through';
  const productName = prodNameRaw || pricingModality;

  // Proyección de fecha fin de contrato considerando prórroga anual automática
  const contractStatusUpper = String(contract?.status || '').trim().toUpperCase();
  const isCancelledContract = ['BAJA', 'CANCELADO', 'ANULADO', 'FINALIZADO', 'RESCINDIDO'].includes(
    contractStatusUpper
  );
  const isAutoRenewal = !isCancelledContract;
  let projectedContractEnd: Date | null = contract?.expectedEndDate
    ? new Date(contract.expectedEndDate)
    : contract?.terminationDate
      ? new Date(contract.terminationDate)
      : null;
  if (
    (!projectedContractEnd || isNaN(projectedContractEnd.getTime())) &&
    (contract?.activationDate || contract?.signatureDate)
  ) {
    const baseStart = new Date(contract.activationDate || contract.signatureDate);
    if (!isNaN(baseStart.getTime())) {
      const durMonths = Number(contract?.duration) > 0 ? Number(contract.duration) : 12;
      projectedContractEnd = new Date(baseStart);
      projectedContractEnd.setMonth(projectedContractEnd.getMonth() + durMonths);
    }
  }
  if (projectedContractEnd && !isNaN(projectedContractEnd.getTime())) {
    const refRenewalTargetMs = isAutoRenewal
      ? Math.max(inclusiveEndDateObj.getTime(), issueDateObj.getTime())
      : inclusiveEndDateObj.getTime();
    let guard = 0;
    while (projectedContractEnd.getTime() < refRenewalTargetMs && guard < 25) {
      projectedContractEnd.setFullYear(projectedContractEnd.getFullYear() + 1);
      guard++;
    }
  }

  // Permanencia activa (solo vigente si la fecha fin de permanencia es posterior a la emisión y al fin de periodo)
  const permMonths = Number(contract?.permanenceMonths ?? contract?.product?.permanenceMonths ?? 0);
  let permanenceEndDate: Date | null = null;
  let hasPermanence = false;
  if (permMonths > 0 && (contract?.permanenceStartDate || contract?.activationDate || contract?.signatureDate)) {
    const pStart = new Date(
      contract.permanenceStartDate || contract.activationDate || contract.signatureDate
    );
    if (!isNaN(pStart.getTime())) {
      const pEnd = new Date(pStart);
      pEnd.setMonth(pEnd.getMonth() + permMonths);
      permanenceEndDate = pEnd;
      hasPermanence =
        pEnd.getTime() > Math.max(inclusiveEndDateObj.getTime(), issueDateObj.getTime());
    }
  }

  // Fecha de cargo / vencimiento y método de cobro
  const paymentDaysRaw =
    client?.paymentTermsDays ??
    parseLooseNum(airData['DIAS PAGO'] ?? airData['Dias Pago'] ?? (client?.airtableData as any)?.['Dias Pago']);
  const paymentDays = paymentDaysRaw > 0 ? Math.round(paymentDaysRaw) : 1;
  const paymentDateObj = invoice.paymentDate
    ? new Date(invoice.paymentDate)
    : new Date(issueDateObj.getTime() + paymentDays * 86400000);

  const isTransferPayment = Boolean(
    contract?.transferencia === true ||
      /transfer/i.test(String(supplyPoint?.paymentMethod || '')) ||
      String(airData['FORMA DE PAGO'] || '').toUpperCase().includes('TRANSFER')
  );
  const paymentMethodType: 'RECIBO' | 'TRANSFERENCIA' = isTransferPayment ? 'TRANSFERENCIA' : 'RECIBO';
  const rawIban = contract?.iban || supplyPoint?.iban || null;
  const companyBankIban = brand?.bankIban1
    ? String(brand.bankIban1).replace(/\u00a0/g, ' ').trim()
    : undefined;
  const companyBankName = brand?.bankName1 ? String(brand.bankName1).trim() : undefined;

  const sepaMandateRef = String(
    airData['Cod. Mandato'] ||
      airData['Codigo Mandato'] ||
      airData['Mandato SEPA'] ||
      (supplyPoint?.airtableData as any)?.['Cod. Mandato'] ||
      (paymentMethodType === 'RECIBO' && (supplyPoint?.mandateSigned || rawIban)
        ? contract?.contractCode || ''
        : '')
  ).trim();

  // Cálculos económicos y fiscales
  const bonoSocial = Number(idata.bonoSocial ?? 0);
  const bonoSocialDailyRate =
    idata.bonoSocialDailyRate !== undefined && Number(idata.bonoSocialDailyRate) !== 0
      ? Number(idata.bonoSocialDailyRate)
      : billingDays > 0
        ? bonoSocial / billingDays
        : 0;

  const cgBolsilloSolarCost = Number(idata.cgBolsilloSolarCost ?? 0);
  const cgBolsilloSolarDailyRate =
    idata.cgBolsilloSolarDailyRate !== undefined && Number(idata.cgBolsilloSolarDailyRate) !== 0
      ? Number(idata.cgBolsilloSolarDailyRate)
      : billingDays > 0 && cgBolsilloSolarCost !== 0
        ? cgBolsilloSolarCost / billingDays
        : 0;

  const hasBolsilloSolar = Boolean(
    idata.hasBolsilloSolar ||
      contract?.bolsilloSolar === true ||
      cgBolsilloSolarCost !== 0 ||
      Number(idata.bolsilloSolarLlenado ?? 0) !== 0 ||
      Number(idata.bolsilloSolarUso ?? 0) !== 0
  );

  const taxType: 'IVA' | 'IGIC' | 'IPSI' = idata.taxType || 'IVA';
  const taxPercentage = Number(invoice.taxPercentage ?? idata.taxPercentage ?? 21);
  const subtotal1 = Number(invoice.subtotal1 ?? 0);
  const taxAmount = Number(invoice.taxAmount ?? 0);
  const totalAmount = Number(invoice.totalAmount ?? 0);
  const totalMWh = Number(invoice.totalMWh ?? idata.totalF1MWh ?? 0);
  const totalBilledKwh = Math.abs(totalMWh * 1000);

  const taxBreakdown: TaxBreakdownItem[] =
    Array.isArray(idata.taxBreakdown) && idata.taxBreakdown.length > 0
      ? idata.taxBreakdown
      : [
          {
            taxType,
            rate: taxPercentage,
            base: subtotal1,
            amount: taxAmount,
            label: `${formatEsNum(taxPercentage, 2)}% ${taxType} (BI ${formatEsNum(subtotal1, 2)} €)`,
          },
        ];

  // Lecturas enriquecidas y modo de control de potencia
  const enrichedReadings = enrichF1ReadingsFromXml(idata.f1Readings, f1Node, tariff);
  const powerControlMode: 'ICP' | 'Maxímetro' =
    enrichedReadings?.ModoControlPotencia === 2 || !tariff.includes('2.0')
      ? 'Maxímetro'
      : 'ICP';

  // Identidad societaria, registro mercantil y logo en memoria
  const companyName = company?.name || brand?.name || 'Comercializadora Eléctrica';
  const companyCif = company?.cif || '-';
  const companyAddress = company?.address || brand?.address || '-';
  const companyEmail = brand?.supportEmail || brand?.email || company?.email || '-';
  const companyPhone = brand?.phone || company?.phone || '-';
  const companyOrdenCnmc = company?.ordenCnmc || 'R2-950';

  let companyWeb = '';
  if (brand?.domain) {
    const cleanDom = String(brand.domain)
      .replace(/^https?:\/\//i, '')
      .replace(/^(clientes|portal|app|area)\./i, '')
      .replace(/\/.*$/, '')
      .trim();
    if (cleanDom) companyWeb = cleanDom.startsWith('www.') ? cleanDom : `www.${cleanDom}`;
  } else if (companyEmail && companyEmail.includes('@')) {
    const emailDom = companyEmail.split('@')[1]?.trim();
    if (emailDom) companyWeb = `www.${emailDom}`;
  }

  const companyRegistroMercantil = String(company?.registroMercantil || '').trim();

  const companyVerticalLegalText = [
    companyName.toUpperCase(),
    companyAddress !== '-' ? companyAddress : '',
    companyCif !== '-' ? `C.I.F. ${companyCif},` : '',
    companyOrdenCnmc ? `Nº Orden Comercializadoras ${companyOrdenCnmc}.` : '',
    companyRegistroMercantil,
  ]
    .filter(Boolean)
    .join(' ');

  const rawLogoUrl = brand?.invoiceLogoUrl || brand?.logoUrl || null;
  const logoDataUri = await resolveLogoDataUri(rawLogoUrl);

  // Resolución de factura rectificada / anulada (Art. 15 RD 1619/2012 AEAT)
  const invoiceType = invoice.invoiceType || deduceInvoiceType(f1Raw) || 'Normal';
  const isRectOrAbono =
    invoiceType === 'Rectificadora' ||
    invoiceType === 'Rectificativa' ||
    invoiceType === 'Abono' ||
    Boolean(dGen?.CodigoFacturaRectificadaAnulada);

  const codRectificadaRaw = dGen?.CodigoFacturaRectificadaAnulada
    ? String(
        Array.isArray(dGen.CodigoFacturaRectificadaAnulada)
          ? dGen.CodigoFacturaRectificadaAnulada[0]
          : dGen.CodigoFacturaRectificadaAnulada
      ).trim()
    : '';
  const codRectificadaNorm = codRectificadaRaw.replace(/^CF\s+/i, '').trim().toUpperCase();

  const resolvedSpId = invoice.supplyPointId || supplyPoint?.id || null;

  // Consultas históricas del punto de suministro (para nota rectificativa, gráfico 14m, acumulados anuales y maxímetro 12m)
  const [spLegacyInvoices, spInternalInvoices, spRecentF1s] = resolvedSpId
    ? await Promise.all([
        prisma.invoice.findMany({
          where: { supplyPointId: resolvedSpId },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceType: true,
            issueDate: true,
            billingStart: true,
            billingEnd: true,
            totalAmount: true,
            totalMWh: true,
            invoiceData: true,
          },
          orderBy: { issueDate: 'desc' },
          take: 36,
        }),
        prisma.internalInvoice.findMany({
          where: {
            supplyPointId: resolvedSpId,
            status: { in: ['EMITIDA', 'ABONO'] },
            ...(invoice.id ? { id: { not: invoice.id } } : {}),
          },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceType: true,
            issueDate: true,
            billingStart: true,
            billingEnd: true,
            totalAmount: true,
            totalMWh: true,
            f1Invoice: { select: { numeroFactura: true } },
          },
          orderBy: { issueDate: 'desc' },
          take: 36,
        }),
        prisma.f1Invoice.findMany({
          where: { supplyPointId: resolvedSpId },
          select: {
            id: true,
            numeroFactura: true,
            fechaInicio: true,
            fechaFin: true,
            jsonData: true,
          },
          orderBy: { fechaInicio: 'desc' },
          take: 30,
        }),
      ])
    : [[], [], []];

  let rectifiedInfo: RectifiedInvoiceInfo | null = null;
  if (isRectOrAbono) {
    let origNum = '';
    let origIssue: Date | string | null = null;
    let origTotal: number | null = null;

    if (invoice.rectifiedInvoiceId) {
      const byIdInt = spInternalInvoices.find((x) => x.id === invoice.rectifiedInvoiceId);
      if (byIdInt && byIdInt.invoiceNumber) {
        origNum = byIdInt.invoiceNumber;
        origIssue = byIdInt.issueDate;
        origTotal = byIdInt.totalAmount;
      } else {
        const byIdLeg = spLegacyInvoices.find((x) => x.id === invoice.rectifiedInvoiceId);
        if (byIdLeg) {
          origNum = byIdLeg.invoiceNumber;
          origIssue = byIdLeg.issueDate;
          origTotal = byIdLeg.totalAmount;
        }
      }
    }

    if (!origNum && codRectificadaNorm) {
      const matchedInt = spInternalInvoices.find((x) => {
        if (x.invoiceType === 'Abono') return false;
        const f1Num = String(x.f1Invoice?.numeroFactura || '')
          .replace(/^CF\s+/i, '')
          .trim()
          .toUpperCase();
        return f1Num === codRectificadaNorm;
      });
      if (matchedInt && matchedInt.invoiceNumber) {
        origNum = matchedInt.invoiceNumber;
        origIssue = matchedInt.issueDate;
        origTotal = matchedInt.totalAmount;
      } else {
        const matchedLeg = spLegacyInvoices.find((x) => {
          if ((x.invoiceType || '').trim().toLowerCase() === 'abono') return false;
          const cfRaw =
            (x.invoiceData as any)?.['Codigo Fiscal'] ||
            (x.invoiceData as any)?.['Código Fiscal'] ||
            '';
          const cfNorm = String(cfRaw).replace(/^CF\s+/i, '').trim().toUpperCase();
          return cfNorm === codRectificadaNorm;
        });
        if (matchedLeg) {
          origNum = matchedLeg.invoiceNumber;
          origIssue = matchedLeg.issueDate;
          origTotal = matchedLeg.totalAmount;
        }
      }
    }

    // Fallback por coincidencia exacta de periodo facturado cuando cambia eslabón intermedio
    if (!origNum && invoice.billingStart && invoice.billingEnd) {
      const curStartIso = toMadridIsoDate(invoice.billingStart);
      const curEndIncIso = toMadridIsoDate(inclusiveEndDateObj);
      const byWindowLeg = spLegacyInvoices.find((x) => {
        if ((x.invoiceType || '').trim().toLowerCase() === 'abono') return false;
        const cfNorm = String((x.invoiceData as any)?.['Codigo Fiscal'] || '')
          .replace(/^CF\s+/i, '')
          .trim()
          .toUpperCase();
        if (cfNorm && f1FiscalCode !== '-' && cfNorm === f1FiscalCode.toUpperCase()) return false;
        const sIso = toMadridIsoDate(x.billingStart);
        const eIso = toMadridIsoDate(x.billingEnd);
        return sIso === curStartIso && eIso === curEndIncIso;
      });
      if (byWindowLeg) {
        origNum = byWindowLeg.invoiceNumber;
        origIssue = byWindowLeg.issueDate;
        origTotal = byWindowLeg.totalAmount;
      }
    }

    if (origNum && origTotal !== null) {
      const absOrigTotal = Math.abs(origTotal);
      if (invoiceType === 'Abono' || totalAmount < 0) {
        const legalNoteText = `(1) Esta Factura de Abono rectifica/anula a su Factura ${origNum} emitida el ${formatMadridDateEs(origIssue)} cuyo importe era ${formatEsNum(absOrigTotal, 2)} €. Supone un abono a su favor de ${formatEsNum(totalAmount, 2)} €.`;
        rectifiedInfo = {
          originalInvoiceNumber: origNum,
          originalIssueDate: origIssue,
          originalTotalAmount: absOrigTotal,
          deltaAmount: totalAmount,
          f1OriginCode: codRectificadaRaw || undefined,
          legalNoteText,
        };
      } else {
        const delta = Math.round((totalAmount - absOrigTotal) * 100) / 100;
        const tipoAjuste = delta >= 0 ? 'cargo' : 'abono';
        const tail =
          delta < 0
            ? ' Esta cantidad quedará a cuenta para próxima Factura o liquidación.'
            : '';
        const legalNoteText = `(1) Esta Factura rectifica a su Factura ${origNum} emitida el ${formatMadridDateEs(origIssue)} cuyo importe era ${formatEsNum(absOrigTotal, 2)} €. La rectificación supone un ${tipoAjuste} de ${formatEsNum(delta, 2)} €.${tail}`;
        rectifiedInfo = {
          originalInvoiceNumber: origNum,
          originalIssueDate: origIssue,
          originalTotalAmount: absOrigTotal,
          deltaAmount: delta,
          f1OriginCode: codRectificadaRaw || undefined,
          legalNoteText,
        };
      }
    } else if (codRectificadaRaw) {
      rectifiedInfo = {
        originalInvoiceNumber: codRectificadaRaw,
        f1OriginCode: codRectificadaRaw,
        legalNoteText: `(1) Factura emitida por rectificación reglamentaria de medidas/facturación ATR comunicada por la empresa distribuidora (Ref. factura origen distribuidora: ${codRectificadaRaw}).`,
      };
    }
  }

  // Construcción de evolución histórica de consumo (últimos 14 meses) y acumulado anual
  const endYm = toMadridIsoDate(inclusiveEndDateObj).substring(0, 7) || toMadridIsoDate(new Date()).substring(0, 7);
  const [endY, endM] = endYm.split('-').map(Number);
  const monthBuckets = new Map<string, number>();
  const orderedMonths: string[] = [];
  for (let offset = 13; offset >= 0; offset--) {
    const dt = new Date(Date.UTC(endY, endM - 1 - offset, 1));
    const ym = dt.toISOString().substring(0, 7);
    orderedMonths.push(ym);
    monthBuckets.set(ym, 0);
  }

  const currentF1Norm = f1FiscalCode !== '-' ? f1FiscalCode.replace(/^AR-/i, '').toUpperCase() : '';

  // Agregar facturas históricas de `Invoice` (Regla 81: Invoice.totalMWh almacena kWh; Abono puede tener signo positivo)
  const seenInvoiceNumbers = new Set<string>();
  if (invoice.invoiceNumber) seenInvoiceNumbers.add(String(invoice.invoiceNumber).toUpperCase());

  for (const leg of spLegacyInvoices) {
    const numKey = String(leg.invoiceNumber || '').toUpperCase();
    if (seenInvoiceNumbers.has(numKey)) continue;

    const cfNorm = String(
      (leg.invoiceData as any)?.['Codigo Fiscal'] || (leg.invoiceData as any)?.['Código Fiscal'] || ''
    )
      .replace(/^CF\s+/i, '')
      .trim()
      .toUpperCase();

    // En Shadow Billing excluimos la contraparte de Ingebau del mismo F1 que estamos previsualizando/emitiendo
    if (currentF1Norm && cfNorm === currentF1Norm) continue;
    if (
      (invoiceType === 'Abono' || totalAmount < 0) &&
      codRectificadaNorm &&
      cfNorm === codRectificadaNorm &&
      (leg.invoiceType || '').toLowerCase() === 'abono'
    ) {
      continue;
    }

    seenInvoiceNumbers.add(numKey);
    const refDate = leg.billingEnd || leg.billingStart || leg.issueDate;
    const ym = toMadridIsoDate(refDate).substring(0, 7);
    if (!ym) continue;

    const rawKwh = Math.abs(Number(leg.totalMWh || 0));
    const isLegAbono = (leg.invoiceType || '').trim().toLowerCase() === 'abono' || leg.totalAmount < 0;
    const signedKwh = isLegAbono ? -rawKwh : rawKwh;
    if (monthBuckets.has(ym)) {
      monthBuckets.set(ym, (monthBuckets.get(ym) || 0) + signedKwh);
    }
  }

  // Agregar facturas internas ya emitidas (si no se promocionaron a Invoice)
  for (const intInv of spInternalInvoices) {
    const numKey = String(intInv.invoiceNumber || '').toUpperCase();
    if (numKey && seenInvoiceNumbers.has(numKey)) continue;
    if (numKey) seenInvoiceNumbers.add(numKey);

    const refIncEnd = getInclusiveEndDate(intInv.billingStart, intInv.billingEnd) || intInv.issueDate;
    const ym = toMadridIsoDate(refIncEnd).substring(0, 7);
    if (!ym) continue;

    const kwh = Math.abs(Number(intInv.totalMWh || 0) * 1000);
    const isIntAbono = intInv.invoiceType === 'Abono' || intInv.totalAmount < 0;
    const signedKwh = isIntAbono ? -kwh : kwh;
    if (monthBuckets.has(ym)) {
      monthBuckets.set(ym, (monthBuckets.get(ym) || 0) + signedKwh);
    }
  }

  // Sumar la factura actual a su mes correspondiente
  const currentSignedKwh = invoiceType === 'Abono' || totalAmount < 0 ? -totalBilledKwh : totalBilledKwh;
  if (monthBuckets.has(endYm)) {
    monthBuckets.set(endYm, (monthBuckets.get(endYm) || 0) + currentSignedKwh);
  }

  const consumptionHistory: MonthlyConsumptionBar[] = orderedMonths.map((ym) => ({
    yearMonth: ym,
    label: formatYearMonthLabelEs(ym),
    kwh: Math.max(0, Math.round((monthBuckets.get(ym) || 0) * 100) / 100),
    isCurrent: ym === endYm,
  }));

  const prevYearYm = `${endY - 1}-${String(endM).padStart(2, '0')}`;
  let prevYearSameMonthKwh: number | null = null;
  if (monthBuckets.has(prevYearYm)) {
    const val = monthBuckets.get(prevYearYm) || 0;
    if (val > 0) prevYearSameMonthKwh = Math.round(val * 100) / 100;
  }

  // Consumo anual por periodos (últimos 12 meses) y potencias máximas demandadas desde F1s del CUPS
  const oneYearAgoMs = inclusiveEndDateObj.getTime() - 366 * 86400000;
  const activeF1ByWindow = new Map<
    string,
    { startIso: string; endIso: string; volsKwh: Record<string, number>; maxKw: Record<string, number> }
  >();

  const allCandidateF1s = f1 ? [f1, ...spRecentF1s.filter((x) => x.id !== f1.id)] : spRecentF1s;
  for (const cand of allCandidateF1s) {
    if (!cand?.fechaFin) continue;
    const candEndMs = new Date(cand.fechaFin).getTime();
    if (candEndMs < oneYearAgoMs || candEndMs > inclusiveEndDateObj.getTime() + 36 * 3600000) continue;

    const cRaw = cand.jsonData as any;
    const cNode =
      cRaw?.FacturaATR ||
      cRaw?.Facturas?.FacturaATR ||
      cRaw ||
      {};
    const cTipo = String(
      cNode?.DatosGeneralesFacturaATR?.DatosGeneralesFactura?.TipoFactura || 'N'
    )
      .trim()
      .toUpperCase();
    if (cTipo === 'A' || cTipo === 'AR' || cTipo === 'S') continue;

    const sIso = toMadridIsoDate(cand.fechaInicio);
    const eIso = toMadridIsoDate(getInclusiveEndDate(cand.fechaInicio, cand.fechaFin));
    const wKey = `${sIso}_${eIso}`;
    if (activeF1ByWindow.has(wKey)) continue; // ordenados desc -> conservamos la más reciente (ej. R sobre N)

    const volsKwh: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    const tActArr = Array.isArray(cNode?.EnergiaActiva?.TerminoEnergiaActiva)
      ? cNode.EnergiaActiva.TerminoEnergiaActiva
      : cNode?.EnergiaActiva?.TerminoEnergiaActiva
        ? [cNode.EnergiaActiva.TerminoEnergiaActiva]
        : [];
    for (const ta of tActArr) {
      const pArr = Array.isArray(ta?.Periodo) ? ta.Periodo : ta?.Periodo ? [ta.Periodo] : [];
      pArr.forEach((pObj: any, idx: number) => {
        const pKey = pObj?.Periodo || pObj?.periodo || `P${idx + 1}`;
        if (volsKwh[pKey] !== undefined) {
          volsKwh[pKey] += Math.abs(parseLooseNum(pObj?.ValorEnergiaActiva ?? pObj?.valorEnergiaActiva));
        }
      });
    }

    const maxKw: Record<string, number> = {};
    const cEnriched = enrichF1ReadingsFromXml(null, cNode, tariff);
    for (let i = 1; i <= 6; i++) {
      const pk = `P${i}`;
      if (cEnriched[pk]?.max > 0) maxKw[pk] = cEnriched[pk].max;
    }

    activeF1ByWindow.set(wKey, { startIso: sIso, endIso: eIso, volsKwh, maxKw });
  }

  const annualConsumptionByPeriod: Record<string, number> = {
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
    P5: 0,
    P6: 0,
  };
  let earliestAnnualStartIso = toMadridIsoDate(invoice.billingStart) || toMadridIsoDate(issueDateObj);

  if (activeF1ByWindow.size > 0) {
    for (const win of activeF1ByWindow.values()) {
      if (win.startIso && win.startIso < earliestAnnualStartIso) {
        earliestAnnualStartIso = win.startIso;
      }
      for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
        annualConsumptionByPeriod[p] += win.volsKwh[p] || 0;
      }
    }
  } else {
    for (const e of Array.isArray(idata.energyAtrDetails) ? idata.energyAtrDetails : []) {
      if (e?.period && annualConsumptionByPeriod[e.period] !== undefined) {
        annualConsumptionByPeriod[e.period] += Math.abs(Number(e.kwh || 0));
      }
    }
  }

  const last12BarsSum = consumptionHistory.slice(-12).reduce((acc, b) => acc + b.kwh, 0);
  const f1AnnualSum = Object.values(annualConsumptionByPeriod).reduce((acc, v) => acc + v, 0);
  const annualTotalKwh = Math.round(Math.max(last12BarsSum, f1AnnualSum, totalBilledKwh) * 100) / 100;

  const dailyAvgKwh = billingDays > 0 ? totalBilledKwh / billingDays : 0;
  const dailyAvgEur = billingDays > 0 ? Math.abs(totalAmount) / billingDays : 0;

  // Potencias máximas demandadas en los últimos 12 meses
  const maxDemandedPowers12m: Record<string, number> = {};
  const xmlMaxAnual = enrichedReadings?.InfoConsumidor?.maxAnualByPeriod || {};
  if (tariff.includes('2.0')) {
    const p1Xml = Number(xmlMaxAnual.P1 || 0);
    const p2Xml = Math.max(Number(xmlMaxAnual.P2 || 0), Number(xmlMaxAnual.P3 || 0));
    if (p1Xml > 0) maxDemandedPowers12m.P1 = p1Xml;
    if (p2Xml > 0) maxDemandedPowers12m.P2 = p2Xml;
  } else {
    for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
      if (Number(xmlMaxAnual[p] || 0) > 0) maxDemandedPowers12m[p] = Number(xmlMaxAnual[p]);
    }
  }
  for (const win of activeF1ByWindow.values()) {
    for (const [pk, val] of Object.entries(win.maxKw)) {
      if (tariff.includes('2.0') && pk === 'P3') {
        maxDemandedPowers12m.P2 = Math.max(maxDemandedPowers12m.P2 || 0, val);
      } else if (!tariff.includes('2.0') || pk === 'P1' || pk === 'P2') {
        maxDemandedPowers12m[pk] = Math.max(maxDemandedPowers12m[pk] || 0, val);
      }
    }
  }

  const postalCodeAvgKwh: number | null = enrichedReadings?.InfoConsumidor?.valorEnergiaMediaCP || null;

  // Textos legales BOE dinámicos según el ejercicio facturado
  const endYearNum = inclusiveEndDateObj.getFullYear();
  const bsNormClean = (idata.bonoSocialLabel || 'Orden TED/1487/2024')
    .replace(/^Financiaci[oó]n del Bono Social\s*\(?/i, '')
    .replace(/\)$/, '')
    .trim();

  const boeLegalText =
    endYearNum >= 2026
      ? `Peajes de transporte y distribución aplicados según Resolución de 18/12/2025 de la CNMC (BOE-A-2025-26348); cargos del sistema eléctrico, pagos por capacidad y retribución del operador del mercado según Orden TED/1524/2025, de 23/12/2025; financiación del Bono Social según ${bsNormClean}; retribución del operador del sistema según Resolución de 23/12/2025 de la CNMC (BOE-A-2025-27211) y aportación al FNEE según Orden TED/133/2026, de 25/02/2026.`
      : `Peajes de transporte y distribución aplicados según Resolución de la CNMC vigente para el periodo facturado; cargos del sistema eléctrico, pagos por capacidad, retribución OM/OS y financiación del Bono Social (${bsNormClean}) según Orden Ministerial MITECO aplicable a cada día natural del suministro.`;

  const indexedFormulaNote = !isFixed
    ? 'Precio del término de energía activa obtenido como ponderación de los precios horarios del mercado diario e intradiario, servicios de ajuste del sistema, pagos por capacidad, retribución OM/OS, FNEE y coeficientes regulatorios de pérdidas con sus correspondientes consumos horarios (reales o perfilados según curva oficial CNMC), conforme a la fórmula indexada pactada en su contrato. Si desea el desglose horario detallado puede solicitarlo en nuestro correo de atención al cliente.'
    : undefined;

  const rawF1Comments = dGen?.Comentarios ? String(dGen.Comentarios).trim() : '';
  const f1DistributorComments = rawF1Comments
    ? rawF1Comments.replace(/\s+\d{1,2}$/, '').trim()
    : undefined;

  // Etiquetado anual de la electricidad según Circular 2/2021 de la CNMC (configurable por Comercializadora en Company.etiquetaCnmc)
  const cnmcLabelCfg = normalizeCnmcLabelConfig(company?.etiquetaCnmc);
  const energyOriginMix: EnergyOriginRow[] = cnmcLabelCfg.mix.map((row) => ({
    source: row.source,
    companyPct: row.companyPct,
    nationalPct: row.nationalPct,
    color: row.color,
  }));

  const environmentalImpact: EnvironmentalImpactData = {
    labelYear: cnmcLabelCfg.labelYear,
    is100RenewableGdo: cnmcLabelCfg.is100RenewableGdo,
    nationalAvgLetter: cnmcLabelCfg.nationalAvgLetter,
    co2Letter: cnmcLabelCfg.co2Letter,
    co2CompanyGPerKwh: cnmcLabelCfg.co2CompanyGPerKwh,
    co2NationalGPerKwh: cnmcLabelCfg.co2NationalGPerKwh,
    radLetter: cnmcLabelCfg.radLetter,
    radCompanyUgPerKwh: cnmcLabelCfg.radCompanyUgPerKwh,
    radNationalUgPerKwh: cnmcLabelCfg.radNationalUgPerKwh,
  };

  // Generación del Código QR oficial del Comparador CNMC (Resolución CNMC 06/10/2022, BOE-A-2022-16989, Anexo I)
  const maxPowerKw = Math.max(0, ...Object.values(contractedPowers));
  const showCnmcQr = Boolean(
    tariff.includes('2.0') && (maxPowerKw === 0 || maxPowerKw <= 15.001) && supplyPoint?.cups
  );

  let cnmcQrUrl: string | undefined;
  let cnmcQrSvgPath: string | undefined;
  let cnmcQrModuleCount: number | undefined;

  if (showCnmcQr) {
    const startIncIso = toMadridIsoDate(invoice.billingStart) || toMadridIsoDate(issueDateObj);
    // BOE-A-2022-16989: iniF e iniA deben consignarse con fecha inicio NO incluida (día anterior al primer día de consumo)
    const iniFIso = shiftIsoDateDays(startIncIso, -1);
    const finFIso = toMadridIsoDate(inclusiveEndDateObj) || startIncIso;
    const iniAIso = shiftIsoDateDays(earliestAnnualStartIso || startIncIso, -1);
    const finContratoIso = projectedContractEnd
      ? toMadridIsoDate(projectedContractEnd)
      : shiftIsoDateDays(finFIso, 365);

    const tfCode =
      invoiceType === 'Rectificadora' || invoiceType === 'Rectificativa'
        ? 'R'
        : invoiceType === 'Abono' || totalAmount < 0
          ? 'A'
          : invoiceType === 'Complementaria'
            ? 'C'
            : invoiceType === 'Regularizadora'
              ? 'G'
              : 'N';

    const p1Kw = contractedPowers.P1 || maxPowerKw || 3.45;
    const p2Kw = contractedPowers.P2 || contractedPowers.P3 || p1Kw;

    const atrDetailsArr = Array.isArray(idata.energyAtrDetails) ? idata.energyAtrDetails : [];
    const mktDetailsArr = Array.isArray(idata.energyMarketDetails) ? idata.energyMarketDetails : [];
    const powDetailsArr = Array.isArray(idata.powerDetails) ? idata.powerDetails : [];

    const getPeriodKwh = (per: string) => {
      const m = mktDetailsArr.find((x: any) => x.period === per);
      const a = atrDetailsArr.find((x: any) => x.period === per);
      return Math.round(Math.abs(Number(m?.kwh ?? a?.kwh ?? 0)));
    };
    const getPeriodEnergyPrice = (per: string) => {
      const m = mktDetailsArr.find((x: any) => x.period === per);
      const a = atrDetailsArr.find((x: any) => x.period === per);
      return Math.abs(Number(m?.price || 0)) + Math.abs(Number(a?.price || 0));
    };
    const getPeriodYearlyPowerPrice = (per: string) => {
      const p = powDetailsArr.find((x: any) => x.period === per);
      if (!p) return 0;
      const daysInYr = endYearNum % 4 === 0 && (endYearNum % 100 !== 0 || endYearNum % 400 === 0) ? 366 : 365;
      return Math.abs(Number(p.price || 0)) * daysInYr;
    };

    const tcCode = !isFixed ? 'B0' : 'E0';
    const revCode = !isFixed ? '3' : '0';

    const qrParams: Array<[string, string]> = [
      ['cp', (supplyPostalCode || '14001').padStart(5, '0').slice(0, 5)],
      ['pP1', Number(p1Kw.toFixed(3)).toString()],
      ['pP2', Number(p2Kw.toFixed(3)).toString()],
      ['caP1', Math.round(annualConsumptionByPeriod.P1 || getPeriodKwh('P1')).toString()],
      ['caP2', Math.round(annualConsumptionByPeriod.P2 || getPeriodKwh('P2')).toString()],
      ['caP3', Math.round(annualConsumptionByPeriod.P3 || getPeriodKwh('P3')).toString()],
      ['iniA', iniAIso],
      ['tc', tcCode],
    ];

    if (hasPermanence && permanenceEndDate) {
      qrParams.push(['finPen', toMadridIsoDate(permanenceEndDate)]);
    }

    qrParams.push(['finContrato', finContratoIso]);
    qrParams.push(['tf', tfCode]);

    if (tfCode === 'N') {
      qrParams.push(['imp', totalAmount.toFixed(2)]);
      qrParams.push(['cfP1', getPeriodKwh('P1').toString()]);
      qrParams.push(['cfP2', getPeriodKwh('P2').toString()]);
      qrParams.push(['cfP3', getPeriodKwh('P3').toString()]);
    }

    qrParams.push(['iniF', iniFIso]);
    qrParams.push(['finF', finFIso]);

    const svaAmt = Number(idata.svaCost ?? 0);
    const otrosConIE =
      Number(idata.excesosPotencia ?? 0) +
      Number(idata.reactiveEnergyCost ?? 0) +
      Number(idata.penalizacionNoIcpCost ?? 0) +
      Number(idata.recargoInfAnioCost ?? 0);
    const otrosSinIE =
      Number(idata.alquilerEquipo ?? 0) +
      cgBolsilloSolarCost +
      Number(idata.conceptosRepercutiblesBase ?? 0);
    const excAmt = Math.abs(Number(idata.excedentesAutoconsumo ?? 0));

    if (tfCode === 'N' && svaAmt > 0) {
      qrParams.push(['impSA', svaAmt.toFixed(2)]);
    }
    if (otrosConIE > 0) {
      qrParams.push(['impOtrosConIE', otrosConIE.toFixed(2)]);
    }
    if (otrosSinIE > 0) {
      qrParams.push(['impOtrosSinIE', otrosSinIE.toFixed(2)]);
    }
    if (supplyPoint?.hasSelfConsumption || contract?.autoconsumo || excAmt > 0) {
      qrParams.push(['exc', excAmt.toFixed(2)]);
    }

    qrParams.push(['com', companyOrdenCnmc]);
    qrParams.push(['cups', String(supplyPoint.cups).trim().slice(0, 22)]);
    qrParams.push([
      'pmaxP1',
      Number((maxDemandedPowers12m.P1 || p1Kw).toFixed(3)).toString(),
    ]);
    qrParams.push([
      'pmaxP2',
      Number((maxDemandedPowers12m.P2 || p2Kw).toFixed(3)).toString(),
    ]);
    qrParams.push(['fFact', toMadridIsoDate(issueDateObj)]);

    if (tfCode === 'N') {
      qrParams.push(['finBS', bonoSocial > 0 ? bonoSocial.toFixed(2) : '0']);
      const impPotVal = Number(idata.powerCost ?? 0);
      const impEnerVal =
        atrDetailsArr.reduce((s: number, x: any) => s + Number(x.total || 0), 0) +
        mktDetailsArr.reduce((s: number, x: any) => s + Number(x.total || 0), 0);
      qrParams.push(['impPot', impPotVal.toFixed(2)]);
      qrParams.push(['impEner', impEnerVal.toFixed(2)]);

      const bsUso = Math.abs(Number(idata.bolsilloSolarUso ?? 0));
      if (bsUso > 0) {
        qrParams.push(['dto', bsUso.toFixed(2)]);
      }

      qrParams.push(['prP1', getPeriodYearlyPowerPrice('P1').toFixed(6)]);
      qrParams.push(['prP2', getPeriodYearlyPowerPrice('P2').toFixed(6)]);
      qrParams.push(['prE1', getPeriodEnergyPrice('P1').toFixed(6)]);
      qrParams.push(['prE2', getPeriodEnergyPrice('P2').toFixed(6)]);
      qrParams.push(['prE3', getPeriodEnergyPrice('P3').toFixed(6)]);
    }

    qrParams.push(['verde', cnmcLabelCfg.is100RenewableGdo ? '1' : '0']);
    qrParams.push(['rev', revCode]);

    const queryStr = qrParams
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    cnmcQrUrl = `https://comparador.cnmc.gob.es/comparador/QRE?${queryStr}`;
    const qrSvg = buildQrSvgPath(cnmcQrUrl);
    if (qrSvg) {
      cnmcQrSvgPath = qrSvg.path;
      cnmcQrModuleCount = qrSvg.size;
    }
  }

  return {
    invoiceNumber: invoice.invoiceNumber || `BORRADOR-${invoice.id.slice(-6).toUpperCase()}`,
    invoiceType,
    issueDate: issueDateObj,
    paymentDate: paymentDateObj,
    billingStart: invoice.billingStart,
    billingEnd: invoice.billingEnd,
    billingDays,

    // Datos corporativos dinámicos (Comercializadora / Marca)
    companyName,
    companyCif,
    companyAddress,
    companyEmail,
    companyPhone,
    companyWeb,
    companyOrdenCnmc,
    companyRegistroMercantil,
    companyVerticalLegalText,
    logoUrl: logoDataUri,
    accentColor: brand?.accentColor || '#e8622a',
    brandPrimaryColor: brand?.surfaceColor || '#133638',

    // Cliente y cobro
    clientName,
    clientNif: client?.vatNumber || '-',
    clientAddress,
    ibanMasked: maskIban(rawIban),
    paymentMethod: supplyPoint?.paymentMethod || 'Domiciliación bancaria',
    paymentMethodType,
    sepaMandateRef,
    companyBankIban,
    companyBankName,

    // Suministro y Contrato
    cups: supplyPoint?.cups || '-',
    supplyAddress: supplyAddress || clientAddress,
    supplyPostalCode,
    tariff,
    cargoSegment,
    cnae: supplyPoint?.cnae || supplyPoint?.sipsCnae || client?.cnae || '-',
    meterSerialNumber:
      idata.meterSerialNumber || enrichedReadings?.NumeroSerie || supplyPoint?.meteringEquipment || '-',
    distributorName:
      supplyPoint?.distributor || distributorRecord?.name || supplyPoint?.distributorName || '-',
    distributorPhone: formattedDistPhone,
    accessContractRef,
    supplyContractRef: contract?.contractCode || contract?.id?.slice(-8).toUpperCase() || '-',
    f1FiscalCode,
    productName,
    pricingModality,
    isFixed,
    contractEndDate: projectedContractEnd,
    isAutoRenewal,
    hasPermanence,
    permanenceEndDate,
    contractedPowers,

    // Totales e impuestos indirectos
    totalMWh,
    subtotal1,
    taxType,
    taxPercentage,
    taxAmount,
    taxBreakdown,
    totalSinDescuentoBolsillo: Number(
      idata.totalSinDescuentoBolsillo ?? subtotal1 + taxAmount + Number(idata.conceptosRepercutiblesExempt ?? 0)
    ),
    totalAmount,

    // Desgloses económicos
    energyCost: Number(idata.energyCost ?? 0),
    powerCost: Number(idata.powerCost ?? 0),
    alquilerEquipo: Number(idata.alquilerEquipo ?? 0),
    bonoSocial,
    bonoSocialDailyRate,
    bonoSocialLabel: idata.bonoSocialLabel,
    baseIEE:
      idata.baseIEE !== undefined
        ? Number(idata.baseIEE)
        : Number(idata.taxElectric ?? 0) > 0
          ? Number(idata.taxElectric) / 0.0511269632
          : 0,
    ieeRate: Number(idata.ieeRate ?? 5.11269632),
    ieeReductionPct: Number(idata.ieeReductionPct ?? 0),
    taxElectric: Number(idata.taxElectric ?? 0),
    feeCost: Number(idata.feeCost ?? invoice.margin ?? 0),
    peajesDistribuidora: Number(idata.peajesDistribuidora ?? 0),
    cargosDistribuidora: Number(idata.cargosDistribuidora ?? 0),

    powerDetails: Array.isArray(idata.powerDetails) ? idata.powerDetails : [],
    energyAtrDetails: Array.isArray(idata.energyAtrDetails) ? idata.energyAtrDetails : [],
    energyMarketDetails: Array.isArray(idata.energyMarketDetails) ? idata.energyMarketDetails : [],
    reactiveEnergyCost: Number(idata.reactiveEnergyCost ?? 0),
    reactiveDetails: Array.isArray(idata.reactiveDetails) ? idata.reactiveDetails : [],
    capacitiveEnergyCost: Number(idata.capacitiveEnergyCost ?? 0),
    excesosPotencia: Number(idata.excesosPotencia ?? 0),
    penalizacionNoIcpCost: Number(idata.penalizacionNoIcpCost ?? 0),
    recargoInfAnioCost: Number(idata.recargoInfAnioCost ?? 0),
    interesesDemoraCost: Number(idata.interesesDemoraCost ?? 0),

    conceptosRepercutibles: Array.isArray(idata.conceptosRepercutibles)
      ? idata.conceptosRepercutibles
      : [],
    conceptosRepercutiblesBase: Number(idata.conceptosRepercutiblesBase ?? 0),
    conceptosRepercutiblesExempt: Number(idata.conceptosRepercutiblesExempt ?? 0),

    // Autoconsumo y Bolsillo Solar
    excedentesAutoconsumo: Number(idata.excedentesAutoconsumo ?? 0),
    excedentesKwh: Number(idata.excedentesKwh ?? 0),
    pexc: idata.pexc ?? contract?.pexc ?? null,
    maxExcedentes: Number(idata.maxExcedentes ?? 0),
    hasBolsilloSolar,
    cgBolsilloSolarCost,
    cgBolsilloSolarDailyRate,
    bolsilloSolarSaldoInicial: Number(idata.bolsilloSolarSaldoInicial ?? 0),
    bolsilloSolarLlenado: Number(idata.bolsilloSolarLlenado ?? 0),
    bolsilloSolarUso: Number(idata.bolsilloSolarUso ?? 0),
    bolsilloSolarSaldoFinal: Number(idata.bolsilloSolarSaldoFinal ?? 0),

    // SVA y lecturas
    svaCost: Number(idata.svaCost ?? 0),
    svaConcept: idata.svaConcept || contract?.svaConcept || undefined,
    svaDetails: Array.isArray(idata.svaDetails) ? idata.svaDetails : [],
    f1Readings: enrichedReadings,
    isOtrasFacturas: Boolean(idata.isOtrasFacturas),

    // Histórico, información regulatoria, etiquetado CNMC y QR
    consumptionHistory,
    annualTotalKwh,
    annualConsumptionByPeriod,
    dailyAvgKwh,
    dailyAvgEur,
    prevYearSameMonthKwh,
    postalCodeAvgKwh,
    maxDemandedPowers12m,
    powerControlMode,
    rectifiedInfo,
    boeLegalText,
    indexedFormulaNote,
    f1DistributorComments,
    energyOriginMix,
    environmentalImpact,
    showCnmcQr,
    cnmcQrUrl,
    cnmcQrSvgPath,
    cnmcQrModuleCount,
  };
}

/**
 * Para una factura F1 Rectificadora (R), localiza su F1 de Abono compañero (S o AR-...) y,
 * si aún no existe en F1Invoice porque el ciclo original era previo a la ingesta XML pero sí
 * existe la factura original al cliente en prisma.invoice, sintetiza automáticamente el F1 AR.
 */
export async function ensureCompanionAbonoF1(rF1: any): Promise<any | null> {
  if (!rF1?.jsonData) return null;
  const f1Node =
    rF1.jsonData?.FacturaATR ||
    rF1.jsonData?.OtrasFacturas ||
    rF1.jsonData?.Facturas?.FacturaATR ||
    rF1.jsonData?.Facturas?.OtrasFacturas ||
    rF1.jsonData ||
    {};
  const dGen =
    f1Node?.DatosGeneralesFacturaATR?.DatosGeneralesFactura ||
    f1Node?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura ||
    f1Node?.DatosGeneralesFactura;
  if (!dGen) return null;

  const tipoRaw = dGen.TipoFactura;
  const tipo = String((Array.isArray(tipoRaw) ? tipoRaw[0] : tipoRaw) || '').trim().toUpperCase();
  if (tipo !== 'R') return null;

  const origRaw = dGen.CodigoFacturaRectificadaAnulada;
  const codOriginal = origRaw ? String(Array.isArray(origRaw) ? origRaw[0] : origRaw).trim() : '';
  const abonoRaw = dGen.CodigoFacturaAbono;
  const codAbono = abonoRaw
    ? String(Array.isArray(abonoRaw) ? abonoRaw[0] : abonoRaw).trim()
    : codOriginal
      ? `AR-${codOriginal}`
      : '';

  if (!codAbono) return null;

  const existingAbono = await prisma.f1Invoice.findFirst({
    where: {
      numeroFactura: codAbono,
      ...(rF1.supplyPointId ? { supplyPointId: rF1.supplyPointId } : {}),
    },
    include: { internalInvoices: { select: { id: true } } },
  });
  if (existingAbono) return existingAbono;

  if (!codOriginal || !rF1.supplyPointId) return null;

  const normTarget = codOriginal.replace(/^CF\s+/i, '').trim().toUpperCase();
  const spLegacyInvoices = await prisma.invoice.findMany({
    where: { supplyPointId: rF1.supplyPointId },
  });
  const matchedLegacy = spLegacyInvoices.find((inv) => {
    if ((inv.invoiceType || '').trim().toLowerCase() === 'abono') return false;
    const cfRaw = (inv.invoiceData as any)?.['Codigo Fiscal'];
    const cfNorm = String(cfRaw || '').replace(/^CF\s+/i, '').trim().toUpperCase();
    return cfNorm === normTarget;
  });

  if (!matchedLegacy) return null;

  const legData = ((matchedLegacy.invoiceData as any) || {}) as Record<string, any>;
  const parseLegNum = (v: any): number => {
    if (v === undefined || v === null || typeof v === 'object') return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const baseF1 = Math.abs(parseLegNum(legData['BaseImponibleF1']));
  const peajesF1 = Math.abs(parseLegNum(legData['TotalImportePeajes']));
  const cargosF1 = Math.abs(parseLegNum(legData['TotalImporteCargos']));
  const rDateStr = dGen.FechaFactura;

  const syntheticJson = JSON.parse(JSON.stringify(rF1.jsonData || {}));
  if (syntheticJson?.DatosGeneralesFacturaATR?.DatosGeneralesFactura) {
    syntheticJson.DatosGeneralesFacturaATR.DatosGeneralesFactura.TipoFactura = 'AR';
    syntheticJson.DatosGeneralesFacturaATR.DatosGeneralesFactura.CodigoFiscalFactura = codAbono;
    syntheticJson.DatosGeneralesFacturaATR.DatosGeneralesFactura.CodigoFacturaRectificadaAnulada =
      codOriginal;
    if (rDateStr) {
      syntheticJson.DatosGeneralesFacturaATR.DatosGeneralesFactura.FechaFactura = rDateStr;
    }
  } else if (syntheticJson?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura) {
    syntheticJson.DatosGeneralesOtrasFacturas.DatosGeneralesFactura.TipoFactura = 'AR';
    syntheticJson.DatosGeneralesOtrasFacturas.DatosGeneralesFactura.CodigoFiscalFactura = codAbono;
    syntheticJson.DatosGeneralesOtrasFacturas.DatosGeneralesFactura.CodigoFacturaRectificadaAnulada =
      codOriginal;
    if (rDateStr) {
      syntheticJson.DatosGeneralesOtrasFacturas.DatosGeneralesFactura.FechaFactura = rDateStr;
    }
  }

  return prisma.f1Invoice.create({
    data: {
      numeroFactura: codAbono,
      tipoDocumento: rF1.tipoDocumento,
      fechaEmision: rF1.fechaEmision,
      fechaInicio: rF1.fechaInicio ?? matchedLegacy.billingStart,
      fechaFin: rF1.fechaFin ?? matchedLegacy.billingEnd,
      saldoFactura: -baseF1,
      baseImponible: -baseF1,
      totalPeajes: -peajesF1,
      totalCargos: -cargosF1,
      xmlUrl: rF1.xmlUrl,
      jsonData: syntheticJson,
      supplyPointId: rF1.supplyPointId,
      contractId: rF1.contractId ?? matchedLegacy.contractId,
      facturaRealizada: true,
    },
    include: { internalInvoices: { select: { id: true } } },
  });
}
