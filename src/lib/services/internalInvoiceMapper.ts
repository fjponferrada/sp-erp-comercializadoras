import { prisma } from '@/lib/prisma';
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

export interface InvoiceTemplateData {
  invoiceNumber: string;
  invoiceType?: string;
  issueDate: Date | string;
  billingStart?: Date | string | null;
  billingEnd?: Date | string | null;
  billingDays?: number;

  // Datos de la comercializadora / marca
  companyName: string;
  companyCif: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  logoUrl: string | null;
  accentColor: string;

  // Datos del cliente
  clientName: string;
  clientNif: string;
  clientAddress: string;
  ibanMasked: string;
  paymentMethod: string;

  // Datos del suministro y contrato
  cups: string;
  supplyAddress: string;
  tariff: string;
  cnae: string;
  meterSerialNumber: string;
  distributorName: string;
  distributorPhone: string;
  accessContractRef: string;
  supplyContractRef: string;
  contractEndDate?: Date | string | null;
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

  // SVA y lecturas
  svaCost: number;
  svaConcept?: string;
  svaDetails: SvaDetailItem[];
  f1Readings?: any;
  isOtrasFacturas?: boolean;
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
  if (clean.length < 8) return clean;
  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-4);
  return `${prefix} **** **** **** **** ${suffix}`;
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
 * Construye los datos enriquecidos de plantilla (PDF y XML) para cualquier InternalInvoice,
 * garantizando total paridad entre la vista previa proforma y la emisión definitiva.
 */
export async function buildInvoiceTemplateData(invoice: any): Promise<InvoiceTemplateData> {
  const idata = (invoice.invoiceData || {}) as Record<string, any>;
  const client = invoice.client || invoice.contract?.client;
  const contract = invoice.contract;
  const supplyPoint = invoice.supplyPoint || contract?.supplyPoint || invoice.f1Invoice?.supplyPoint;
  const brand = contract?.brand || client?.brand || null;
  const company = invoice.company || brand?.company || null;
  const f1 = invoice.f1Invoice;

  // Buscar distribuidora por código REE para obtener nombre y teléfono oficial de averías
  let distributorRecord: { name: string; phone: string | null } | null = null;
  const reeCode = supplyPoint?.distributorReeCode
    ? String(supplyPoint.distributorReeCode).trim().padStart(4, '0')
    : null;

  if (reeCode) {
    distributorRecord = await prisma.distributor.findFirst({
      where: {
        OR: [{ reeCode }, { reeCode: String(supplyPoint.distributorReeCode).trim() }],
      },
      select: { name: true, phone: true },
    });
  }

  // Extraer referencia de contrato ATR desde el XML/JSON del F1 si existe
  const f1Raw = f1?.jsonData as any;
  const f1Node =
    f1Raw?.FacturaATR ||
    f1Raw?.OtrasFacturas ||
    f1Raw?.Facturas?.FacturaATR ||
    f1Raw?.Facturas?.OtrasFacturas ||
    f1Raw ||
    {};
  const accessContractRef =
    String(
      f1Node?.DatosGeneralesFacturaATR?.Contrato?.CodigoContrato ||
        f1Node?.DatosGeneralesFacturaATR?.DatosFacturaATR?.CodigoContrato ||
        f1Node?.DatosGeneralesFacturaATR?.DatosGeneralesFactura?.CodigoContrato ||
        f1Node?.DatosGeneralesOtrasFacturas?.Contrato?.CodigoContrato ||
        (contract?.airtableData as any)?.['Contrato Acceso'] ||
        '-'
    ).trim() || '-';

  // Nombre completo del titular
  const fullPersonName = [client?.firstName, client?.lastName, client?.lastName2]
    .filter(Boolean)
    .join(' ')
    .trim();
  const clientName = client?.businessName || fullPersonName || 'Cliente Desconocido';

  // Dirección fiscal del cliente vs dirección física del suministro
  const supplyAddress = [
    supplyPoint?.address,
    pickSpanishPostalCode(supplyPoint?.postalCode, supplyPoint?.sipsPostalCode) || null,
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
  const taxBreakdown: TaxBreakdownItem[] =
    Array.isArray(idata.taxBreakdown) && idata.taxBreakdown.length > 0
      ? idata.taxBreakdown
      : [
          {
            taxType,
            rate: taxPercentage,
            base: subtotal1,
            amount: taxAmount,
            label: `${taxPercentage}% ${taxType} (BI ${subtotal1.toFixed(2).replace('.', ',')} €)`,
          },
        ];

  const rawIban = contract?.iban || supplyPoint?.iban || null;

  return {
    invoiceNumber: invoice.invoiceNumber || `BORRADOR-${invoice.id.slice(-6).toUpperCase()}`,
    invoiceType: invoice.invoiceType || 'Normal',
    issueDate: invoice.issueDate || new Date(),
    billingStart: invoice.billingStart,
    billingEnd: invoice.billingEnd,
    billingDays,

    // Datos corporativos dinámicos (Comercializadora / Marca)
    companyName: company?.name || brand?.name || 'Comercializadora Eléctrica',
    companyCif: company?.cif || '-',
    companyAddress: company?.address || brand?.address || '-',
    companyEmail: brand?.supportEmail || brand?.email || company?.email || '-',
    companyPhone: brand?.phone || brand?.whatsappPhone || company?.phone || '-',
    logoUrl: brand?.invoiceLogoUrl || brand?.logoUrl || null,
    accentColor: brand?.accentColor || '#1e3a5f',

    // Cliente
    clientName,
    clientNif: client?.vatNumber || '-',
    clientAddress,
    ibanMasked: maskIban(rawIban),
    paymentMethod: supplyPoint?.paymentMethod || 'Domiciliación bancaria',

    // Suministro y Contrato
    cups: supplyPoint?.cups || '-',
    supplyAddress: supplyAddress || clientAddress,
    tariff: supplyPoint?.tariff || contract?.product?.tariff || '2.0TD',
    cnae: supplyPoint?.cnae || supplyPoint?.sipsCnae || client?.cnae || '-',
    meterSerialNumber:
      idata.meterSerialNumber || idata.f1Readings?.NumeroSerie || supplyPoint?.meteringEquipment || '-',
    distributorName:
      distributorRecord?.name || supplyPoint?.distributorName || supplyPoint?.distributor || '-',
    distributorPhone: distributorRecord?.phone || '900 000 000',
    accessContractRef,
    supplyContractRef: contract?.contractCode || contract?.id?.slice(-8).toUpperCase() || '-',
    contractEndDate: contract?.expectedEndDate || null,
    contractedPowers,

    // Totales e impuestos indirectos
    totalMWh: Number(invoice.totalMWh ?? idata.totalF1MWh ?? 0),
    subtotal1,
    taxType,
    taxPercentage,
    taxAmount,
    taxBreakdown,
    totalSinDescuentoBolsillo: Number(
      idata.totalSinDescuentoBolsillo ?? subtotal1 + taxAmount + Number(idata.conceptosRepercutiblesExempt ?? 0)
    ),
    totalAmount: Number(invoice.totalAmount ?? 0),

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
    f1Readings: idata.f1Readings || null,
    isOtrasFacturas: Boolean(idata.isOtrasFacturas),
  };
}
