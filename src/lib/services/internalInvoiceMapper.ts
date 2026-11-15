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

function roundNum(val: number, dec = 2): number {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, dec);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Normaliza la tipología de factura al catálogo exacto de `/facturas` e Ingebau
 * (`Normal`, `Abono`, `Rectificativa`, `Complementaria`, `Regularizadora`).
 */
export function normalizeOfficialInvoiceType(rawType?: string | null, isAbonoFlag = false): string {
  if (isAbonoFlag) return 'Abono';
  const s = String(rawType || '').trim();
  if (!s) return 'Normal';
  const upper = s.toUpperCase();
  if (upper === 'A' || upper === 'AR' || upper === 'S' || upper.includes('ABONO') || upper === 'ANULADORA') {
    return 'Abono';
  }
  if (upper === 'R' || upper.startsWith('RECTIFIC')) {
    return 'Rectificativa';
  }
  if (upper === 'C' || upper.startsWith('COMPLEMENT')) {
    return 'Complementaria';
  }
  if (upper === 'G' || upper.startsWith('REGULARIZ')) {
    return 'Regularizadora';
  }
  return 'Normal';
}

/**
 * Convierte cualquier fecha al mediodía UTC (`12:00:00.000Z`) de su día calendario en `Europe/Madrid`,
 * idéntico a `parseExcelDate` en `importInvoicesAction` para que `formatDateUTC` y `formatDateES_UTC`
 * jamás sufran desfases de +/-1 día en listados mixtos ni exportaciones Excel.
 */
export function toUtcNoonFromMadridDate(dateInput?: Date | string | null): Date | null {
  const iso = toMadridIsoDate(dateInput);
  if (!iso || iso.length < 10) return null;
  const d = new Date(`${iso}T12:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

export interface IngebauCanonicalBuildInput {
  invoice: any;
  templateData?: InvoiceTemplateData | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
}

/**
 * Genera de forma síncrona el diccionario completo de campos compatible 100% con el CSV de Ingebau
 * (conservando simultáneamente todos los campos camelCase modernos del motor interno), garantizando
 * paridad absoluta en:
 * - Exportación oficial de 65 columnas (`/api/facturas/export` y `/api/facturas-internas/export`)
 * - Ficha detallada de 8 bloques (`/facturas/[id]` y `/facturas-internas/[id]`)
 * - Modelo 560, Tasa Municipal 1,5%, Reclamaciones, Análisis Económico, CNMC y MITECO.
 */
export function buildIngebauCanonicalFieldsSync(input: IngebauCanonicalBuildInput): Record<string, any> {
  const { invoice, templateData } = input;
  const idata = ((invoice?.invoiceData as Record<string, any>) || {});
  const client = invoice?.client || invoice?.contract?.client || null;
  const contract = invoice?.contract || null;
  const sp = invoice?.supplyPoint || contract?.supplyPoint || invoice?.f1Invoice?.supplyPoint || null;
  const brand = contract?.brand || client?.brand || null;
  const company = invoice?.company || brand?.company || null;
  const f1 = invoice?.f1Invoice || null;

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

  const isInvAbono =
    invoice?.status === 'ABONO' ||
    String(invoice?.invoiceType || '').toLowerCase().includes('abono') ||
    Number(invoice?.totalAmount || 0) < 0;

  const officialType = normalizeOfficialInvoiceType(
    templateData?.invoiceType || invoice?.invoiceType,
    isInvAbono
  );
  const sign = isInvAbono ? -1 : 1;
  const applySign = (val: number): number => {
    if (!val) return 0;
    return isInvAbono ? -Math.abs(val) : val;
  };

  const tariff = String(
    templateData?.tariff || sp?.tariff || contract?.product?.tariff || idata['Tarifa'] || '2.0TD'
  ).trim();
  const is20TD = tariff.includes('2.0');

  const billingDays = Math.max(
    1,
    Math.round(
      Number(
        templateData?.billingDays ??
          idata.billingDays ??
          idata['Dias'] ??
          (Array.isArray(idata.powerDetails) && idata.powerDetails[0]?.days
            ? idata.powerDetails[0].days
            : 30)
      ) || 30
    )
  );

  const issueDateStr =
    formatMadridDateEs(templateData?.issueDate || invoice?.issueDate) !== '-'
      ? formatMadridDateEs(templateData?.issueDate || invoice?.issueDate)
      : '';
  const paymentDateCandidate =
    templateData?.paymentDate ||
    invoice?.paymentDate ||
    (invoice?.issueDate ? new Date(new Date(invoice.issueDate).getTime() + 2 * 86400000) : null);
  const paymentDateStr =
    formatMadridDateEs(paymentDateCandidate) !== '-' ? formatMadridDateEs(paymentDateCandidate) : '';

  const desdeStr =
    formatMadridDateEs(invoice?.billingStart) !== '-' ? formatMadridDateEs(invoice?.billingStart) : '';
  const hastaStr =
    formatMadridInclusiveEndEs(invoice?.billingStart, invoice?.billingEnd) !== '-'
      ? formatMadridInclusiveEndEs(invoice?.billingStart, invoice?.billingEnd)
      : '';

  const enrichedReadings = enrichF1ReadingsFromXml(idata.f1Readings, f1Node, tariff);

  let procDesde = '';
  let procHasta = '';
  for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
    if (!procDesde && enrichedReadings?.[p]?.procIni) procDesde = enrichedReadings[p].procIni;
    if (!procHasta && enrichedReadings?.[p]?.procFin) procHasta = enrichedReadings[p].procFin;
  }
  if (!procHasta) procHasta = procDesde || (is20TD ? 'Telegestión' : 'Telemedida');
  if (!procDesde) procDesde = procHasta;

  const powDetails: any[] = Array.isArray(idata.powerDetails) ? idata.powerDetails : [];
  const atrDetails: any[] = Array.isArray(idata.energyAtrDetails) ? idata.energyAtrDetails : [];
  const mktDetails: any[] = Array.isArray(idata.energyMarketDetails) ? idata.energyMarketDetails : [];
  const reactDetails: any[] = Array.isArray(idata.reactiveDetails) ? idata.reactiveDetails : [];

  // Extraer excesos de potencia por periodo del XML F1 si existen
  const excessByPeriod: Record<string, number> = {};
  const excPotNode = f1Node?.ExcesoPotencia;
  if (excPotNode) {
    const rawTerms = excPotNode.TerminoExcesoPotencia ?? excPotNode.Periodo;
    const termArr = Array.isArray(rawTerms) ? rawTerms : rawTerms ? [rawTerms] : [];
    termArr.forEach((t: any, idx: number) => {
      const pKey = t?.Periodo || `P${idx + 1}`;
      const val = parseLooseNum(t?.ImporteExcesoPotencia ?? t?.ValorExcesoPotencia);
      if (val !== 0) {
        excessByPeriod[pKey] = roundNum((excessByPeriod[pKey] || 0) + val, 2);
      }
    });
  }

  // Extraer excedentes físicos por periodo del XML F1 si existen
  const surplusByPeriod: Record<string, number> = {};
  const autoNode = f1Node?.Autoconsumo ?? f1Node?.EnergiaExcedentaria;
  if (autoNode) {
    const rawAutoPer =
      autoNode?.EnergiaExcedentaria?.TerminoEnergiaExcedentaria ??
      autoNode?.EnergiaExcedentaria?.Periodo ??
      autoNode?.TerminoEnergiaExcedentaria ??
      autoNode?.Periodo;
    const autoArr = Array.isArray(rawAutoPer) ? rawAutoPer : rawAutoPer ? [rawAutoPer] : [];
    autoArr.forEach((t: any, idx: number) => {
      const pKey = t?.Periodo || `P${idx + 1}`;
      const val = Math.abs(parseLooseNum(t?.ValorEnergiaExcedentaria ?? t?.Cantidad ?? t?.Energia));
      if (val > 0) {
        surplusByPeriod[pKey] = roundNum((surplusByPeriod[pKey] || 0) + val, 3);
      }
    });
  }

  const periodFields: Record<string, any> = {};
  let sumPeajesPot = 0;
  let sumCargosPot = 0;
  let sumAtrPot = 0;
  let sumClientPot = 0;

  let sumPeajesEne = 0;
  let sumCargosEne = 0;
  let sumAtrEne = 0;
  let sumClientEne = 0;
  let sumReactKvarh = 0;

  for (let i = 1; i <= 6; i++) {
    const p = `P${i}`;
    const pFieldKey = `p${i}c`;
    const isPowerPeriodActive = is20TD ? i <= 2 : true;
    const isEnergyPeriodActive = is20TD ? i <= 3 : true;

    const pDet = powDetails.find((x: any) => x.period === p);
    const atrDet = atrDetails.find((x: any) => x.period === p);
    const mktDet = mktDetails.find((x: any) => x.period === p);
    const rDet = reactDetails.find((x: any) => x.period === p);
    const rSlot = enrichedReadings?.[p] || {};

    const rawContractKw =
      templateData?.contractedPowers?.[p] ??
      pDet?.kw ??
      contract?.[pFieldKey] ??
      sp?.[pFieldKey] ??
      null;
    const kwVal = rawContractKw !== null && rawContractKw !== undefined ? Number(rawContractKw) : 0;

    periodFields[`${p}C`] = isPowerPeriodActive && kwVal > 0 ? roundNum(kwVal, 3) : null;
    periodFields[`${p} Potencia Contratada`] =
      isPowerPeriodActive && kwVal > 0 ? roundNum(kwVal, 3) : null;
    periodFields[`Potencia a Facturar ${p}`] = pDet?.kw ? roundNum(Math.abs(Number(pDet.kw)), 3) : 0;

    const maxKw = Number(rSlot?.max || 0);
    periodFields[`${p} Potencia Max Demanda`] = isEnergyPeriodActive ? roundNum(maxKw, 3) : null;

    // Potencia económica por periodo
    const pClientEur = pDet ? roundNum(applySign(Number(pDet.total || 0)), 2) : 0;
    const pPeajeEur = pDet ? roundNum(applySign(Number(pDet.peajeEur || 0)), 2) : 0;
    const pCargoEur = pDet ? roundNum(applySign(Number(pDet.cargoEur || 0)), 2) : 0;
    const pAtrEur = roundNum(pPeajeEur + pCargoEur, 2);
    const kwDays = Math.abs(Number(pDet?.kw || kwVal || 0)) * billingDays;

    const pUnitPrice = pDet ? roundNum(Math.abs(Number(pDet.price || 0)), 6) : 0;
    const pAtrUnit = kwDays > 0 ? roundNum(Math.abs(pAtrEur) / kwDays, 6) : 0;
    const pPeajeUnit = kwDays > 0 ? roundNum(Math.abs(pPeajeEur) / kwDays, 6) : 0;
    const pCargoUnit = kwDays > 0 ? roundNum(Math.abs(pCargoEur) / kwDays, 6) : 0;

    periodFields[`${p}P`] = pUnitPrice;
    periodFields[`${p}PM`] = pAtrUnit;
    periodFields[`Precio Ponderado ATR Potencia ${p}`] = pAtrUnit;
    periodFields[`Precio Ponderado Peajes Potencia ${p}`] = pPeajeUnit;
    periodFields[`Precio Ponderado Cargos Potencia ${p}`] = pCargoUnit;
    periodFields[`Importe PM ${p}`] = pClientEur;
    periodFields[`Importe Ponderado Peajes Potencia ${p}`] = pPeajeEur;
    periodFields[`Importe Ponderado Cargos Potencia ${p}`] = pCargoEur;
    periodFields[`Importe Ponderado ATR Potencia ${p}`] = pAtrEur;
    periodFields[`Importe Exceso PM ${p}`] =
      excessByPeriod[p] !== undefined ? roundNum(applySign(excessByPeriod[p]), 2) : null;

    sumPeajesPot = roundNum(sumPeajesPot + pPeajeEur, 2);
    sumCargosPot = roundNum(sumCargosPot + pCargoEur, 2);
    sumAtrPot = roundNum(sumAtrPot + pAtrEur, 2);
    sumClientPot = roundNum(sumClientPot + pClientEur, 2);

    // Energía física y lecturas por periodo
    const rawKwh =
      mktDet?.kwh !== undefined
        ? Number(mktDet.kwh)
        : atrDet?.kwh !== undefined
          ? Number(atrDet.kwh)
          : idata.periods?.[p]?.f1ConsumptionMWh !== undefined
            ? Number(idata.periods[p].f1ConsumptionMWh) * 1000
            : Number(rSlot?.actCons || 0);
    const kwhVal = roundNum(applySign(rawKwh), 3);

    periodFields[`${p} Energia Activa Consumida`] =
      isEnergyPeriodActive || kwhVal !== 0 ? kwhVal : null;

    const rKvarh = Number(rDet?.excessKvarh ?? rDet?.kvarh ?? rSlot?.reactCons ?? 0);
    if (rKvarh !== 0) {
      const signedR = roundNum(applySign(rKvarh), 3);
      periodFields[`${p} Energia Reactiva Consumida`] = signedR;
      sumReactKvarh = roundNum(sumReactKvarh + signedR, 3);
    } else {
      periodFields[`${p} Energia Reactiva Consumida`] = null;
    }

    periodFields[`Excedentes ${p} Autoconsumo`] =
      surplusByPeriod[p] !== undefined ? surplusByPeriod[p] : null;

    periodFields[`Lectura Desde AE ${p}`] =
      rSlot?.actIni !== undefined && rSlot.actIni !== '-' && rSlot.actIni !== ''
        ? String(rSlot.actIni)
        : null;
    periodFields[`Lectura Hasta AE ${p}`] =
      rSlot?.actFin !== undefined && rSlot.actFin !== '-' && rSlot.actFin !== ''
        ? String(rSlot.actFin)
        : null;
    periodFields[`Lectura Desde R1 ${p}`] =
      rSlot?.reactIni !== undefined && rSlot.reactIni !== '-' && rSlot.reactIni !== ''
        ? String(rSlot.reactIni)
        : null;
    periodFields[`Lectura Hasta R1 ${p}`] =
      rSlot?.reactFin !== undefined && rSlot.reactFin !== '-' && rSlot.reactFin !== ''
        ? String(rSlot.reactFin)
        : null;

    // Energía económica por periodo (en Ingebau Importe AE Px = ATR + Energía Activa del cliente)
    const ePeajeEur = atrDet ? roundNum(applySign(Number(atrDet.peajeEur || 0)), 2) : 0;
    const eCargoEur = atrDet ? roundNum(applySign(Number(atrDet.cargoEur || 0)), 2) : 0;
    const eAtrEur = atrDet
      ? roundNum(applySign(Number(atrDet.total ?? ePeajeEur + eCargoEur)), 2)
      : 0;
    const eMktEur = mktDet ? roundNum(applySign(Number(mktDet.total || 0)), 2) : 0;
    const eCombinedEur = roundNum(eAtrEur + eMktEur, 2);

    const absKwh = Math.abs(kwhVal);
    const eAtrPrice = atrDet
      ? Math.abs(Number(atrDet.price || 0))
      : absKwh > 0
        ? Math.abs(eAtrEur) / absKwh
        : 0;
    const eMktPrice = mktDet
      ? Math.abs(Number(mktDet.price || 0))
      : absKwh > 0
        ? Math.abs(eMktEur) / absKwh
        : 0;
    const eCombinedPrice = roundNum(eAtrPrice + eMktPrice, 6);
    const ePeajePrice = absKwh > 0 ? roundNum(Math.abs(ePeajeEur) / absKwh, 6) : 0;
    const eCargoPrice = absKwh > 0 ? roundNum(Math.abs(eCargoEur) / absKwh, 6) : 0;

    periodFields[`${p}E`] = eCombinedPrice;
    periodFields[`Importe AE ${p}`] = eCombinedEur;
    periodFields[`Importe AE Indexado ${p}`] = !idata.isFixed ? eMktEur : null;
    periodFields[`Importe AE Fijo ${p}`] = idata.isFixed ? eMktEur : null;
    periodFields[`Precio Ponderado ATR Energia ${p}`] = roundNum(eAtrPrice, 6);
    periodFields[`Precio Ponderado Peajes Energia ${p}`] = ePeajePrice;
    periodFields[`Precio Ponderado Cargos Energia ${p}`] = eCargoPrice;
    periodFields[`Importe Ponderado Peajes Energia ${p}`] = ePeajeEur;
    periodFields[`Importe Ponderado Cargos Energia ${p}`] = eCargoEur;
    periodFields[`Importe Ponderado ATR Energia ${p}`] = eAtrEur;

    const rCostEur = rDet ? roundNum(applySign(Number(rDet.cost || 0)), 2) : 0;
    const rUnitPrice = rDet ? roundNum(Math.abs(Number(rDet.price || 0)), 6) : 0;
    periodFields[`${p} Precio Energia Reactiva`] = rUnitPrice;
    periodFields[`Importe R1 ${p}`] = rCostEur;

    sumPeajesEne = roundNum(sumPeajesEne + ePeajeEur, 2);
    sumCargosEne = roundNum(sumCargosEne + eCargoEur, 2);
    sumAtrEne = roundNum(sumAtrEne + eAtrEur, 2);
    sumClientEne = roundNum(sumClientEne + eCombinedEur, 2);
  }

  // Totales físicos y económicos
  // En InternalInvoice existe el campo `status` ('BORRADOR' | 'EMITIDA' | 'ABONO' | 'REQUIERE_REPARACION'):
  //   - totalMWh está en MWh, subtotal1 = Base Imponible IVA, taxAmount = Cuota IVA/IGIC/IPSI
  // En Invoice (tabla maestra) NO existe `status`:
  //   - totalMWh está en kWh (Regla 81), subtotal1 = Subtotal 1 (Base IEE), taxAmount = Cuota IEE
  const isInternalModel = typeof invoice?.status === 'string';
  const totalMwhReal =
    idata.totalF1MWh !== undefined
      ? Number(idata.totalF1MWh)
      : isInternalModel
        ? Number(invoice?.totalMWh || 0)
        : Number(invoice?.totalMWh || 0) / 1000;
  const totalKwhSigned = roundNum(applySign(Math.abs(totalMwhReal) * 1000), 3);

  const powerFacturaTotal = roundNum(
    idata.powerCost !== undefined ? applySign(Number(idata.powerCost)) : sumClientPot,
    2
  );
  const energyFacturaTotal = roundNum(sumClientEne, 2);
  const reactiveTotalEur = roundNum(applySign(Number(idata.reactiveEnergyCost || 0)), 2);
  const excesosTotalEur = roundNum(applySign(Number(idata.excesosPotencia || 0)), 2);

  const baseIeeVal = roundNum(
    applySign(
      idata.baseIEE !== undefined
        ? Number(idata.baseIEE)
        : !isInternalModel && invoice?.subtotal1 !== undefined && invoice?.subtotal1 !== null
          ? Math.abs(Number(invoice.subtotal1))
          : Math.abs(powerFacturaTotal) + Math.abs(energyFacturaTotal)
    ),
    2
  );
  const ieeRateVal =
    idata.ieeRate !== undefined
      ? Number(idata.ieeRate)
      : !isInternalModel && invoice?.taxPercentage !== undefined && invoice?.taxPercentage !== null
        ? Number(invoice.taxPercentage)
        : 5.11269632;
  const taxElectricVal = roundNum(
    applySign(
      idata.taxElectric !== undefined
        ? Number(idata.taxElectric)
        : !isInternalModel && invoice?.taxAmount !== undefined && invoice?.taxAmount !== null
          ? Math.abs(Number(invoice.taxAmount))
          : 0
    ),
    2
  );

  // Indicador Mínimo IE Superado (Art. 99.1 vs 99.2 LIIEE para Modelo 560)
  const ieeReductionPct = Number(idata.ieeReductionPct || 0);
  const expectedPctQuota =
    Math.abs(baseIeeVal) * (1 - ieeReductionPct / 100) * (ieeRateVal / 100);
  const minRatePerMwh = is20TD || tariff.includes('3.0') ? 1.0 : 0.5;
  const minLegalQuota = Math.abs(totalMwhReal) * minRatePerMwh;
  const minimoIeSuperado = expectedPctQuota >= minLegalQuota - 0.005 ? '1' : '0';

  const bonoSocialVal = roundNum(applySign(Number(idata.bonoSocial || 0)), 2);
  const alquilerVal = roundNum(applySign(Number(idata.alquilerEquipo || 0)), 2);
  const svaVal = roundNum(applySign(Number(idata.svaCost || 0)), 2);
  const cgBolsilloVal = roundNum(applySign(Number(idata.cgBolsilloSolarCost || 0)), 2);
  const repBaseVal = roundNum(applySign(Number(idata.conceptosRepercutiblesBase || 0)), 2);
  const repExemptVal = roundNum(applySign(Number(idata.conceptosRepercutiblesExempt || 0)), 2);

  const subtotal2Val = roundNum(baseIeeVal + taxElectricVal, 2);
  const subtotalOtrosVal = roundNum(svaVal + cgBolsilloVal + repBaseVal, 2);

  // Base Imponible general de impuestos indirectos (en InternalInvoice subtotal1 = totalBase)
  const rawBaseIvaFromModel = isInternalModel
    ? invoice?.subtotal1
    : idata['Base Imponible IVA'];
  const baseIvaGeneral = roundNum(
    applySign(
      rawBaseIvaFromModel !== undefined && rawBaseIvaFromModel !== null
        ? Math.abs(Number(rawBaseIvaFromModel))
        : Math.abs(subtotal2Val + bonoSocialVal + alquilerVal + subtotalOtrosVal)
    ),
    2
  );
  const rawIndirectTaxFromModel = isInternalModel
    ? invoice?.taxAmount
    : idata['Importe IVA'];
  const totalIndirectTax = roundNum(
    applySign(
      rawIndirectTaxFromModel !== undefined && rawIndirectTaxFromModel !== null
        ? Math.abs(Number(rawIndirectTaxFromModel))
        : 0
    ),
    2
  );
  const taxPctIndirect = Number(
    idata.taxPercentage ??
      idata['IVA'] ??
      (isInternalModel ? invoice?.taxPercentage : undefined) ??
      21
  );
  const taxTypeIndirect = String(idata.taxType || 'IVA').toUpperCase();

  let base0 = repExemptVal;
  let base5 = 0;
  let iva5 = 0;
  let base10 = 0;
  let iva10 = 0;
  let base21 = 0;
  let iva21 = 0;

  const taxBrk: any[] = Array.isArray(idata.taxBreakdown) ? idata.taxBreakdown : [];
  if (taxBrk.length > 0 && taxTypeIndirect === 'IVA') {
    for (const tb of taxBrk) {
      const r = Math.round(Number(tb.rate || 0));
      const b = roundNum(applySign(Number(tb.base || 0)), 2);
      const q = roundNum(applySign(Number(tb.amount || 0)), 2);
      if (r === 0) base0 = roundNum(base0 + b, 2);
      else if (r === 5) {
        base5 = roundNum(base5 + b, 2);
        iva5 = roundNum(iva5 + q, 2);
      } else if (r === 10) {
        base10 = roundNum(base10 + b, 2);
        iva10 = roundNum(iva10 + q, 2);
      } else {
        base21 = roundNum(base21 + b, 2);
        iva21 = roundNum(iva21 + q, 2);
      }
    }
  } else if (taxTypeIndirect === 'IVA') {
    if (Math.round(taxPctIndirect) === 0) {
      base0 = roundNum(base0 + baseIvaGeneral, 2);
    } else if (Math.round(taxPctIndirect) === 5) {
      base5 = baseIvaGeneral;
      iva5 = totalIndirectTax;
    } else if (Math.round(taxPctIndirect) === 10) {
      base10 = baseIvaGeneral;
      iva10 = totalIndirectTax;
    } else {
      base21 = baseIvaGeneral;
      iva21 = totalIndirectTax;
    }
  } else {
    // IGIC / IPSI: las bases exentas a Base Imponible 0 y el resto accesible en Base Imponible IVA / Base Imponible 21 fallback
    for (const tb of taxBrk) {
      if (Number(tb.rate || 0) === 0) {
        base0 = roundNum(base0 + applySign(Number(tb.base || 0)), 2);
      }
    }
  }

  const totalPeajesF1 = roundNum(
    applySign(
      f1?.totalPeajes !== null && f1?.totalPeajes !== undefined
        ? Math.abs(Number(f1.totalPeajes))
        : Math.abs(Number(idata.peajesDistribuidora || sumPeajesPot + sumPeajesEne))
    ),
    2
  );
  const totalCargosF1 = roundNum(
    applySign(
      f1?.totalCargos !== null && f1?.totalCargos !== undefined
        ? Math.abs(Number(f1.totalCargos))
        : Math.abs(Number(idata.cargosDistribuidora || sumCargosPot + sumCargosEne))
    ),
    2
  );
  const f1BaseVal = roundNum(
    applySign(
      f1?.baseImponible !== null && f1?.baseImponible !== undefined
        ? Math.abs(Number(f1.baseImponible))
        : Math.abs(totalPeajesF1) + Math.abs(totalCargosF1) + Math.abs(alquilerVal)
    ),
    2
  );

  // Tasa Municipal 1,5% (Art. 24.1.c TRLRHL)
  const svaSeparableAbs = Math.abs(svaVal) + Math.abs(cgBolsilloVal);
  const baseTasaMunAbs = Math.max(
    0,
    roundNum(
      Math.abs(baseIvaGeneral) -
        Math.abs(bonoSocialVal) -
        Math.abs(taxElectricVal) -
        Math.abs(f1BaseVal) -
        svaSeparableAbs,
      2
    )
  );
  const baseTasaMunicipal = roundNum(sign * baseTasaMunAbs, 2);
  const tasaMunicipal = roundNum(baseTasaMunicipal * 0.015, 2);

  // Autoconsumo y Bolsillo Solar
  const excKwhAbs = Math.abs(Number(idata.excedentesKwh || 0));
  const excEurAbs = Math.abs(Number(idata.excedentesAutoconsumo || 0));
  const maxExcAbs = Math.abs(Number(idata.maxExcedentes || 0));
  const hasBolsillo = Boolean(
    idata.hasBolsilloSolar ||
      idata.bolsilloSolarSaldoInicial ||
      idata.bolsilloSolarLlenado ||
      idata.bolsilloSolarUso ||
      idata.bolsilloSolarSaldoFinal ||
      idata.cgBolsilloSolarCost
  );

  // Rentabilidad comercial interna
  const margenPotencia = roundNum(applySign(Math.abs(Number(idata.powerMargin || 0))), 2);
  const margenEnergia = roundNum(
    isInvAbono && Number(idata.energyMargin || 0) > 0
      ? -Number(idata.energyMargin || 0)
      : Number(idata.energyMargin || 0),
    2
  );
  const margenFactura = roundNum(
    invoice?.margin !== undefined && invoice?.margin !== null
      ? isInvAbono && Number(invoice.margin) > 0
        ? -Number(invoice.margin)
        : Number(invoice.margin)
      : margenPotencia + margenEnergia,
    2
  );
  const importeEnergiaSinMargen = roundNum(energyFacturaTotal - margenEnergia, 2);
  const comisionProrrateada = contract?.commissionFinal
    ? roundNum(sign * ((Math.abs(Number(contract.commissionFinal)) * billingDays) / 365), 2)
    : 0;

  // Datos postales y sistema eléctrico
  const cpPs =
    templateData?.supplyPostalCode ||
    pickSpanishPostalCode(sp?.postalCode, sp?.sipsPostalCode) ||
    '';
  const cpPrefix = cpPs.slice(0, 2);
  const sistemaElectrico =
    cpPrefix === '35' || cpPrefix === '38'
      ? 'canarias'
      : cpPrefix === '07'
        ? 'baleares'
        : cpPrefix === '51' || cpPrefix === '52'
          ? 'ceuta_melilla'
          : 'peninsula';

  // Código fiscal F1 y código contrato ATR
  const rawFiscalCode =
    templateData?.f1FiscalCode && templateData.f1FiscalCode !== '-'
      ? templateData.f1FiscalCode
      : String(dGen?.CodigoFiscalFactura || f1?.numeroFactura || '').trim();
  const formattedCodigoFiscal = rawFiscalCode
    ? rawFiscalCode.toUpperCase().startsWith('CF ')
      ? rawFiscalCode
      : `CF ${rawFiscalCode}`
    : '';

  const rawAccessContract =
    templateData?.accessContractRef && templateData.accessContractRef !== '-'
      ? templateData.accessContractRef
      : String(
          f1Node?.DatosGeneralesFacturaATR?.CodContrato ||
            f1Node?.DatosGeneralesOtrasFacturas?.CodContrato ||
            sp?.atrContractCode ||
            ''
        ).trim();
  const formattedCodigoContrato = rawAccessContract
    ? rawAccessContract.toUpperCase().startsWith('CC ')
      ? rawAccessContract
      : `CC ${rawAccessContract}`
    : '';

  const rawMotivo = String(
    f1Node?.DatosGeneralesFacturaATR?.DatosFacturaATR?.MotivoFacturacion ||
      dGen?.MotivoFacturacion ||
      '01'
  ).trim();

  const clientNif = templateData?.clientNif || client?.vatNumber || '';
  const clientFirstOrBiz =
    client?.businessName ||
    client?.firstName ||
    templateData?.clientName ||
    '';

  const repItems: any[] = Array.isArray(idata.conceptosRepercutibles)
    ? idata.conceptosRepercutibles
    : [];
  const repFields: Record<string, any> = {
    'Concepto Repercutible': roundNum(repBaseVal + repExemptVal, 2),
  };
  for (let idx = 1; idx <= 4; idx++) {
    const item = repItems[idx - 1];
    repFields[`Concepto Repercutible ${idx}`] = item?.description || item?.code || null;
    repFields[`Importe Concepto Repercutible ${idx}`] = item
      ? roundNum(applySign(Number(item.total || 0)), 2)
      : null;
  }

  const finalPdfUrl = input.pdfUrl || invoice?.pdfUrl || idata.pdfUrl || null;
  const finalXmlUrl = input.xmlUrl || invoice?.xmlUrl || idata.xmlUrl || null;
  const invNum =
    invoice?.invoiceNumber ||
    templateData?.invoiceNumber ||
    (invoice?.id ? `BORRADOR-${String(invoice.id).slice(-6).toUpperCase()}` : '');

  const rectOrigNum =
    templateData?.rectifiedInfo?.originalInvoiceNumber ||
    idata['Numero factura rectificada'] ||
    null;
  const rectOrigDate = templateData?.rectifiedInfo?.originalIssueDate
    ? formatMadridDateEs(templateData.rectifiedInfo.originalIssueDate)
    : idata['Fecha factura rectificada'] || null;
  const rectOrigAmt =
    templateData?.rectifiedInfo?.originalTotalAmount ??
    idata['Importe factura rectificada'] ??
    null;
  const rectF1Code =
    templateData?.rectifiedInfo?.f1OriginCode ||
    String(dGen?.CodigoFacturaRectificadaAnulada || '').trim() ||
    null;

  return {
    ...idata,
    ...periodFields,
    ...repFields,

    // Identificación y cabecera
    'Numero Factura': invNum,
    'Tipo Factura': officialType,
    'Clase Factura': 'OO',
    'Motivo Factura': rawMotivo,
    'Fecha Factura': issueDateStr,
    'Fecha Cobro': paymentDateStr,
    'DIAS PAGO': 2,
    'Desde': desdeStr,
    'Desde(EA)': desdeStr,
    'Desde(P)': desdeStr,
    'Hasta': hastaStr,
    'Hasta(EA)': hastaStr,
    'Hasta(P)': hastaStr,
    'Dias': billingDays,
    'Dias CORR': billingDays,
    'Numero Dias Alquiler 1': billingDays,
    'Numero factura rectificada': rectOrigNum,
    'Fecha factura rectificada': rectOrigDate !== '-' ? rectOrigDate : null,
    'Importe factura rectificada': rectOrigAmt,
    'Codigo Factura Rectificada Anulada': rectF1Code,
    'Mostrar_Web': 'SI',

    // Titular, suministro, contrato y distribuidora
    'CIF': clientNif,
    'NOMBRE/RAZON SOCIAL': clientFirstOrBiz,
    'Primer Apellido': client?.lastName || '',
    'Segundo Apellido': client?.lastName2 || '',
    'Tipo de cliente': /^[0-9XYZKL]/i.test(clientNif) ? 'F' : 'J',
    'DOMICILIO SOC': client?.address || '',
    'CP SOC': pickSpanishPostalCode(client?.billingPostalCode, cpPs) || '',
    'POBLACION SOC': client?.billingCity || sp?.city || '',
    'PROVINCIA SOC': client?.billingProvince || sp?.province || '',
    'IBAN': contract?.iban || client?.iban || '',
    'MANDATO': templateData?.sepaMandateRef || contract?.contractCode || null,
    'CUPS': templateData?.cups || sp?.cups || '',
    'CNAE': (templateData?.cnae && templateData.cnae !== '-' ? templateData.cnae : sp?.cnae) || '',
    'DOMICILIO PS': sp?.address || '',
    'CP PS': cpPs,
    'POBLACION PS': sp?.city || '',
    'PROVINCIA PS': sp?.province || '',
    'SISTEMA ELECTRICO': sistemaElectrico,
    'Tarifa': tariff,
    'Tarifa ATR': tariff,
    'CONTRATO':
      (templateData?.supplyContractRef && templateData.supplyContractRef !== '-'
        ? templateData.supplyContractRef
        : contract?.contractCode) || '',
    'Duracion': contract?.duration || 12,
    'Fecha Fin Contrato': templateData?.contractEndDate
      ? formatMadridDateEs(templateData.contractEndDate)
      : null,
    'FIJO / INDEX': idata.isFixed ? 'Fijo' : 'Indexado',
    'Tipo Producto': contract?.product?.type || templateData?.productName || '',
    'FEE': idata.feeApplied ?? contract?.fee ?? contract?.product?.fee ?? null,
    'FEEM': idata.feeCost !== undefined ? roundNum(applySign(Number(idata.feeCost)), 2) : null,
    'DSV': contract?.product?.deviationCost ?? null,
    'DSVM': null,
    'CANAL': contract?.user?.name || '',
    'MARCA': brand?.name || '',
    'Comercializadora': brand?.name || company?.name || '',
    'Empresa Emisora': templateData?.companyName || company?.name || '',
    'CIF Emisora': templateData?.companyCif || company?.cif || '',
    'Direccion Emisora': templateData?.companyAddress || company?.address || '',
    'Email Emisora': templateData?.companyEmail || company?.email || '',
    'Telefono Emisora': templateData?.companyPhone || company?.phone || '',
    'DISTRIBUIDORA': sp?.distributorName || templateData?.distributorName || sp?.distributor || '',
    'Telefono': templateData?.distributorPhone || '',
    'Codigo REE': String(
      f1Raw?.Cabecera?.CodigoREEEmpresaEmisora ||
        f1Raw?.MensajeFacturacion?.Cabecera?.CodigoREEEmpresaEmisora ||
        ''
    ).trim(),
    'Codigo Contrato': formattedCodigoContrato,
    'Codigo Fiscal': formattedCodigoFiscal,
    'Numero Serie':
      (templateData?.meterSerialNumber && templateData.meterSerialNumber !== '-'
        ? templateData.meterSerialNumber
        : idata.meterSerialNumber) || '',
    'Modo Control Potencia': templateData?.powerControlMode || (is20TD ? 'ICP' : 'Maxímetro'),
    'Procedencia Desde': procDesde,
    'Procedencia Hasta': procHasta,
    'Tipo Autoconsumo': sp?.selfConsumptionType || null,
    'Tipo Autoconsumo Distribuidora': String(autoNode?.TipoAutoconsumo || '0'),

    // Totales físicos
    'Energía Total Consumida': totalKwhSigned,
    'Reactiva Total Consumida': sumReactKvarh,
    'Porcentaje Perdidas': null,

    // Totales económicos Potencia y Energía
    'Importe Ponderado Peajes Potencia': sumPeajesPot,
    'Importe Peajes PM': sumPeajesPot,
    'Importe Ponderado Cargos Potencia': sumCargosPot,
    'Importe Cargo Potencia Total': sumCargosPot,
    'Importe Potencia ATR': sumAtrPot,
    'Importe Total PM ATR': sumAtrPot,
    'Importe Total Excesos ATR': excesosTotalEur,
    'Importe Total Excesos ATR F1': excesosTotalEur,
    'Importe Potencia Factura': powerFacturaTotal,

    'Importe Ponderado Peajes Energia': sumPeajesEne,
    'Importe Peajes AE': sumPeajesEne,
    'Importe Ponderado Cargos Energia': sumCargosEne,
    'Importe Cargo Energia Total': sumCargosEne,
    'Importe Energia ATR': sumAtrEne,
    'Importe Total AE ATR': sumAtrEne,
    'Importe Energia Factura': energyFacturaTotal,
    'Importe Total R ATR': reactiveTotalEur,
    'Importe Ajuste Gas': 0,

    // Excedentes, Bolsillo Solar, SVA y Regulados
    'Excedentes Autoconsumo a facturar': excKwhAbs > 0 ? roundNum(excKwhAbs, 3) : null,
    'Energia Neta Total Generada': excKwhAbs > 0 ? roundNum(excKwhAbs, 3) : null,
    'Importe Excedentes Autoconsumo Aplicado': excEurAbs > 0 ? roundNum(excEurAbs, 2) : null,
    'Importe Excedentes Autoconsumo': excEurAbs > 0 ? roundNum(excEurAbs, 2) : null,
    'Importe Aplicable Compensacion Excedentes': maxExcAbs > 0 ? roundNum(maxExcAbs, 2) : null,
    'PEX': idata.pexc ?? null,
    'BOLSILLO SOLAR': hasBolsillo ? 'SI' : 'NO',
    'Inicio Bolsillo Solar': hasBolsillo
      ? roundNum(Number(idata.bolsilloSolarSaldoInicial || 0), 2)
      : null,
    'Carga Bolsillo Solar': hasBolsillo
      ? roundNum(Number(idata.bolsilloSolarLlenado || 0), 2)
      : null,
    'Descuento Bolsillo Solar': hasBolsillo
      ? roundNum(Math.abs(Number(idata.bolsilloSolarUso || 0)), 2)
      : null,
    'Importe almacenado Bolsillo Solar': hasBolsillo
      ? roundNum(Number(idata.bolsilloSolarSaldoFinal || 0), 2)
      : null,
    'Costes de Gestion Bolsillo Solar': cgBolsilloVal,
    'Costes de Gestión': cgBolsilloVal,

    'Importe Bono Social': bonoSocialVal,
    'Alquiler Equipo de Medida': alquilerVal,
    'Precio Dia Alquiler 1':
      billingDays > 0 && alquilerVal !== 0
        ? roundNum(Math.abs(alquilerVal) / billingDays, 6)
        : null,
    'Penalizacion No ICP':
      Number(idata.penalizacionNoIcpCost || 0) !== 0
        ? roundNum(applySign(Number(idata.penalizacionNoIcpCost)), 2)
        : null,
    'RecargoInfAnio':
      Number(idata.recargoInfAnioCost || 0) !== 0
        ? String(roundNum(applySign(Number(idata.recargoInfAnioCost)), 2))
        : 'NO',
    'Suplemento Territorial': 0,
    'Concepto SVA': idata.svaConcept || null,
    'Total SVA': svaVal !== 0 ? svaVal : null,
    'Importe SVA': svaVal,
    'Días SVA': svaVal !== 0 ? billingDays : null,

    // Subtotales, Impuestos y Totales
    'Subtotal 1': baseIeeVal,
    'Base 560': baseIeeVal,
    'Impuesto (%)': ieeRateVal,
    'Importe Impuesto': taxElectricVal,
    'Minimo Importe IE Superado': minimoIeSuperado,
    'Subtotal 2': subtotal2Val,
    'Subtotal Otros Concepto': subtotalOtrosVal,
    'IVA': taxPctIndirect,
    'Base Imponible IVA': baseIvaGeneral,
    'Base Imponible 0': base0,
    'Base Imponible 5': base5,
    'Importe IVA 5': iva5,
    'Base Imponible 10': base10,
    'Importe IVA 10': iva10,
    'Base Imponible 21': base21 || (taxTypeIndirect !== 'IVA' ? baseIvaGeneral : 0),
    'Importe IVA 21': iva21,
    'Importe IVA': totalIndirectTax,
    'Total sin Descuento': roundNum(
      applySign(Math.abs(Number(idata.totalSinDescuentoBolsillo ?? invoice?.totalAmount ?? 0))),
      2
    ),
    'Total': roundNum(applySign(Math.abs(Number(invoice?.totalAmount || 0))), 2),

    'TotalImportePeajes': totalPeajesF1,
    'TotalImporteCargos': totalCargosF1,
    'BaseImponibleF1': f1BaseVal,
    'Base Imponible Fichero': f1BaseVal,
    'Base Imponible Tasa Municipal': baseTasaMunicipal,
    'Tasa Municipal': tasaMunicipal,

    // Rentabilidad comercial interna
    'Importe Energia sin Margen': importeEnergiaSinMargen,
    'Margen Potencia': margenPotencia,
    'Margen Energia': margenEnergia,
    'Margen Excesos': 0,
    'Margen Factura': margenFactura,
    'Margen Factura Total': margenFactura,
    'Comision Total': comisionProrrateada,
    'Comision Generada Total': comisionProrrateada,

    // Enlaces en la nube
    pdfUrl: finalPdfUrl,
    xmlUrl: finalXmlUrl,
  };
}

/**
 * Construye el payload oficial completo para `prisma.invoice` (incluyendo resolución de `rectifiedInvoiceId`
 * contra facturas históricas de Ingebau o del propio motor interno y normalización de fechas a 12:00 UTC
 * con `billingEnd` inclusivo).
 */
export async function buildOfficialInvoicePayloadFromInternal(params: {
  invoice: any;
  templateData?: InvoiceTemplateData | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
}) {
  const { invoice } = params;
  const tpl = params.templateData ?? (await buildInvoiceTemplateData(invoice));
  const sp = invoice.supplyPoint || invoice.contract?.supplyPoint || invoice.f1Invoice?.supplyPoint;

  const canonicalData = buildIngebauCanonicalFieldsSync({
    invoice,
    templateData: tpl,
    pdfUrl: params.pdfUrl ?? invoice.pdfUrl,
    xmlUrl: params.xmlUrl ?? invoice.xmlUrl,
  });

  const isInvAbono =
    invoice.status === 'ABONO' ||
    String(invoice.invoiceType || '').toLowerCase().includes('abono') ||
    Number(invoice.totalAmount || 0) < 0;

  const officialInvoiceType = normalizeOfficialInvoiceType(
    tpl.invoiceType || invoice.invoiceType,
    isInvAbono
  );

  // Resolver clave foránea `rectifiedInvoiceId` en `prisma.invoice` (tanto si la original era de Ingebau como del Motor Interno)
  let rectifiedInvoiceId: string | null = null;
  const origNum = tpl.rectifiedInfo?.originalInvoiceNumber?.trim();
  if (origNum) {
    const brandId = invoice.contract?.brandId || invoice.client?.brandId || undefined;
    const foundOrig = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: origNum,
        ...(invoice.companyId
          ? {
              OR: [
                { companyId: invoice.companyId },
                ...(brandId ? [{ client: { brandId } }] : []),
              ],
            }
          : brandId
            ? { client: { brandId } }
            : {}),
      },
      select: { id: true },
    });
    if (foundOrig) {
      rectifiedInvoiceId = foundOrig.id;
    }
  }

  const inclusiveEnd = getInclusiveEndDate(invoice.billingStart, invoice.billingEnd);
  const issueDateUtc = toUtcNoonFromMadridDate(tpl.issueDate || invoice.issueDate) || new Date();
  const paymentDateUtc = toUtcNoonFromMadridDate(tpl.paymentDate);
  const billingStartUtc = toUtcNoonFromMadridDate(invoice.billingStart);
  const billingEndUtc = toUtcNoonFromMadridDate(inclusiveEnd);

  const officialPayload = {
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: officialInvoiceType,
    clientId: invoice.clientId,
    companyId: invoice.companyId,
    contractId: invoice.contractId,
    supplyPointId: invoice.supplyPointId || sp?.id || null,
    f1InvoiceId: invoice.f1InvoiceId,
    rectifiedInvoiceId,
    issueDate: issueDateUtc,
    paymentDate: paymentDateUtc,
    billingStart: billingStartUtc,
    billingEnd: billingEndUtc,
    subtotal1: Number(canonicalData['Subtotal 1'] || 0),
    taxPercentage: Number(canonicalData['Impuesto (%)'] || 5.11269632),
    taxAmount: Number(canonicalData['Importe Impuesto'] || 0),
    totalAmount: Number(canonicalData['Total'] || invoice.totalAmount || 0),
    totalMWh: Number(canonicalData['Energía Total Consumida'] || 0),
    margin: Number(canonicalData['Margen Factura'] || 0),
    origin: 'INTERNAL_ENGINE',
    pdfUrl: params.pdfUrl ?? invoice.pdfUrl ?? null,
    xmlUrl: params.xmlUrl ?? invoice.xmlUrl ?? null,
    invoiceData: canonicalData as any,
  };

  return {
    canonicalData,
    officialPayload,
    templateData: tpl,
  };
}
