import { prisma } from '@/lib/prisma';
import { fromZonedTime } from 'date-fns-tz';

export interface BillingPeriodBreakdown {
  period: string;
  cchConsumptionMWh: number;
  f1ConsumptionMWh: number;
  energyCostEur: number; // For fixed: (PxE - refATR + regDiffs) * MWh. For indexed: Ph * MWh
  regulatedCostEur: number; // Peajes + Cargos de energía
}

export interface ConceptoRepercutibleItem {
  code: string;
  description: string;
  units: number;
  unitPrice: number;
  total: number;
  taxTypeCode: string; // Tabla 114: '1' = General, '2' = Reducido, '3' = Exento
}

export interface SvaDetailItem {
  name: string;
  days: number;
  dailyPrice: number;
  total: number;
}

export interface TaxBreakdownItem {
  taxType: 'IVA' | 'IGIC' | 'IPSI';
  rate: number;
  base: number;
  amount: number;
  label: string;
}

export interface BillingCalculationResult {
  hasMismatch: boolean;
  hasCriticalError?: boolean;
  mismatchReason?: string;
  totalCchMWh: number;
  totalF1MWh: number;
  billingDays?: number;
  periods: Record<string, BillingPeriodBreakdown>;

  energyCost: number;
  feeCost: number;
  capacityCost: number;
  fneeCost: number;
  bonoSocial: number;
  bonoSocialDailyRate?: number;
  bonoSocialLabel?: string;

  powerCost: number; // Término de potencia facturado al cliente
  peajesDistribuidora: number; // Peajes energía (referencia calculada BOE)
  cargosDistribuidora: number; // Cargos energía (referencia calculada BOE)

  totalBase: number; // Base Imponible sujeta a impuestos indirectos (IVA/IGIC/IPSI)
  taxType?: 'IVA' | 'IGIC' | 'IPSI';
  taxPercentage?: number;
  taxAmount: number;
  taxBreakdown?: TaxBreakdownItem[];
  totalSinDescuentoBolsillo?: number;
  totalAmount: number;

  alquilerEquipo?: number;
  baseIEE?: number;
  ieeRate?: number;
  ieeReductionPct?: number;
  taxElectric?: number;

  excesosPotencia?: number;
  capacitiveEnergyCost?: number;
  penalizacionNoIcpCost?: number;
  recargoInfAnioCost?: number;
  interesesDemoraCost?: number;
  conceptosRepercutibles?: ConceptoRepercutibleItem[];
  conceptosRepercutiblesBase?: number; // Sujetos a IVA/IGIC/IPSI
  conceptosRepercutiblesExempt?: number; // Exentos de IVA/IGIC/IPSI (ej. depósitos/indemnizaciones)

  excedentesAutoconsumo?: number;
  maxExcedentes?: number;
  hasBolsilloSolar?: boolean;
  cgBolsilloSolarCost?: number;
  cgBolsilloSolarDailyRate?: number;
  bolsilloSolarSaldoInicial?: number;
  bolsilloSolarLlenado?: number;
  bolsilloSolarUso?: number;
  bolsilloSolarSaldoFinal?: number;

  hourlyDetails: any[];
  reactiveEnergyCost: number;
  reactiveDetails: any[];
  repairData: any | null;
  svaCost?: number;
  svaConcept?: string;
  svaDetails?: SvaDetailItem[];

  powerDetails?: any[];
  energyAtrDetails?: any[];
  energyMarketDetails?: any[];

  // Margins
  energyMargin?: number;
  powerMargin?: number;
  f1Readings?: any;
  meterSerialNumber?: string;
  excedentesKwh?: number;
  pexc?: number | null;
  isFixed?: boolean;
  isOtrasFacturas?: boolean;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// Festivos nacionales fijos no sustituibles según Circular 3/2020 de la CNMC
const FIXED_NATIONAL_HOLIDAYS = new Set([
  '01-01', // Año Nuevo
  '01-06', // Epifanía del Señor
  '05-01', // Fiesta del Trabajo
  '08-15', // Asunción de la Virgen
  '10-12', // Fiesta Nacional de España
  '11-01', // Todos los Santos
  '12-06', // Día de la Constitución Española
  '12-08', // Inmaculada Concepción
  '12-25', // Natividad del Señor
]);

// Tabla 103 CNMC - Conceptos Repercutibles
const TABLA_103_CONCEPTOS: Record<string, string> = {
  '01': 'Indemnización distribuidora',
  '02': 'Derechos de extensión',
  '03': 'Derechos de acceso',
  '04': 'Derechos de enganche',
  '05': 'Derechos de verificación',
  '06': 'Depósito de garantía',
  '07': 'Gastos de anulación de contratos',
  '08': 'Actuaciones en equipos de medida',
  '09': 'Reparametrización de equipos de medida',
  '11': 'Intereses de demora ATR',
  '12': 'Verificación de equipos de medida',
  '13': 'Derechos de reconexión',
  '15': 'Gastos de acometida',
  '16': 'Abonos distribuidora',
  '17': 'Abono por calidad de suministro',
  '18': 'Abono por calidad individual',
  '19': 'Coste de reposición',
  '20': 'Supervisión de instalaciones cedidas',
  '33': 'Coste de reconexión a petición de comercializador',
  '40': 'Recargo fraccionado refacturación (Orden IET/843/2012 4T 2011)',
  '41': 'Recargo fraccionado refacturación (Orden IET/843/2012 1T 2012)',
  '42': 'Recargo fraccionado refacturación (Orden IET/843/2012 Abr 2012)',
  '43': 'Cargo fijo autoconsumo',
  '44': 'Cargo variable autoconsumo',
  '45': 'Exención cargo fijo autoconsumo',
  '46': 'Exención cargo variable autoconsumo',
  '47': 'Derechos de acometida de generación',
  '48': 'Suplemento territorial (Orden ETU/35/2017)',
  '49': 'Suplemento territorial (Orden TEC/271/2019)',
  '83': 'Recargo no dedicación exclusiva carga VE',
  '84': 'Descuento peajes industria electrointensiva',
  '85': 'Regularización descuento industria electrointensiva',
  '86': 'Descuento por retardo en activación de autoconsumo (distribuidor)',
  '87': 'Descuento por retardo en activación de autoconsumo',
};

// Códigos Tabla 103 que NO son repercutibles al cliente (reposiciones E2 art. normativa CNMC) o son meramente informativos
const NON_REPERCUTIBLE_E2_CODES = new Set(['88', '89', '90', '91']);
const INFORMATIONAL_AUTOCONSUMO_CODES = new Set([
  '51', '52', '53', '54', '55', '56',
  '61', '62', '63', '64', '65', '66',
  '71', '72', '73', '74', '75', '76',
  '81', '82',
]);

export function getPeriodoREE(dt: Date, tariff: string, postalCode?: string): string {
  const localStr = dt.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
  const y = parseInt(localStr.substring(0, 4), 10);
  const m = parseInt(localStr.substring(5, 7), 10);
  const d = parseInt(localStr.substring(8, 10), 10);
  const h = parseInt(localStr.substring(11, 13), 10);
  const mmdd = localStr.substring(5, 10);

  const localDateObj = new Date(y, m - 1, d);
  const w = localDateObj.getDay();
  const isWeekend = w === 0 || w === 6;
  const isHol = isWeekend || FIXED_NATIONAL_HOLIDAYS.has(mmdd);

  const cp = (postalCode || '').trim();
  const isCeutaMelilla = cp.startsWith('51') || cp.startsWith('52');

  if (tariff.includes('2.0TD')) {
    if (isHol || (h >= 0 && h < 8)) return 'P3';
    if (isCeutaMelilla) {
      // Horario específico Ceuta y Melilla según Circular 3/2020 (punta 11-15 y 19-23)
      if ([8, 9, 10, 15, 16, 17, 18, 23].includes(h)) return 'P2';
      return 'P1';
    }
    if ([8, 9, 14, 15, 16, 17, 22, 23].includes(h)) return 'P2';
    return 'P1';
  }

  if (isHol || (h >= 0 && h < 8)) return 'P6';

  // En Ceuta y Melilla las puntas/llanos de 3.0TD/6.XTD se desplazan +1h respecto a Península (Circular 3/2020 Anexo II)
  const isPeakHour = isCeutaMelilla
    ? (h >= 11 && h < 15) || (h >= 19 && h < 23)
    : (h >= 9 && h < 14) || (h >= 18 && h < 22);

  if (cp.startsWith('35') || cp.startsWith('38')) {
    // Temporadas Canarias (Circular 3/2020 Anexo I)
    const isPeakCanarias = (h >= 10 && h < 15) || (h >= 18 && h < 22);
    if ([7, 8, 9, 10].includes(m)) return isPeakCanarias ? 'P1' : 'P2';
    if ([11, 12].includes(m)) return isPeakCanarias ? 'P2' : 'P3';
    if ([1, 2, 3].includes(m)) return isPeakCanarias ? 'P3' : 'P4';
    return isPeakCanarias ? 'P4' : 'P5';
  }

  if (isCeutaMelilla) {
    if ([1, 2, 7, 8, 9, 12].includes(m)) return isPeakHour ? 'P1' : 'P2';
    if ([3, 10, 11].includes(m)) return isPeakHour ? 'P3' : 'P4';
    return isPeakHour ? 'P4' : 'P5';
  }

  if ([1, 2, 7, 12].includes(m)) return isPeakHour ? 'P1' : 'P2';
  if ([3, 11].includes(m)) return isPeakHour ? 'P2' : 'P3';
  if ([4, 5, 10].includes(m)) return isPeakHour ? 'P4' : 'P5';
  if ([6, 8, 9].includes(m)) return isPeakHour ? 'P3' : 'P4';

  return 'P6';
}

function getArray(val: any): any[] {
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

function parseXmlNum(val: any): number {
  if (val === undefined || val === null) return 0;
  const raw = Array.isArray(val) ? val[0] : (val?._ ?? val);
  if (raw === undefined || raw === null || raw === '') return 0;
  const parsed = parseFloat(raw.toString().replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Convierte potencias de XML CNMC (expresadas en W enteros según Facturacion.xsd) a kW.
 * Mantiene compatibilidad si algún JSON sintético ya viene en kW con decimales (ej. 3.3).
 */
function parseCnmcPowerKw(rawVal: any, rawPrecioPotencia?: any): number {
  if (rawVal === undefined || rawVal === null) return 0;
  const str = (Array.isArray(rawVal) ? rawVal[0] : rawVal).toString().trim().replace(',', '.');
  const num = parseFloat(str);
  if (isNaN(num) || num === 0) return 0;
  const precio = rawPrecioPotencia !== undefined ? Math.abs(parseXmlNum(rawPrecioPotencia)) : 0;
  // En CNMC Facturacion.xsd el campo es xs:integer en Watios y PrecioPotencia está en €/W/día (< 0.005)
  if (!str.includes('.') && (num > 50 || (precio > 0 && precio < 0.005))) {
    return num / 1000.0;
  }
  if (num > 1000) return num / 1000.0;
  return num;
}

/**
 * Invierte de forma exhaustiva y consistente todos los importes y volúmenes para facturas de Abono (A, AR, S).
 */
function invertBillingResult(source: BillingCalculationResult): BillingCalculationResult {
  const clone = JSON.parse(JSON.stringify(source)) as BillingCalculationResult;
  const inv = (v: number | undefined | null): any =>
    v !== undefined && v !== null ? (v === 0 ? 0 : -v) : v;

  clone.totalAmount = inv(clone.totalAmount);
  clone.totalBase = inv(clone.totalBase);
  clone.taxAmount = inv(clone.taxAmount);
  clone.totalSinDescuentoBolsillo = inv(clone.totalSinDescuentoBolsillo);
  clone.powerMargin = inv(clone.powerMargin);
  clone.energyMargin = inv(clone.energyMargin);
  clone.energyCost = inv(clone.energyCost);
  clone.feeCost = inv(clone.feeCost);
  clone.capacityCost = inv(clone.capacityCost);
  clone.fneeCost = inv(clone.fneeCost);
  clone.bonoSocial = inv(clone.bonoSocial);
  clone.peajesDistribuidora = inv(clone.peajesDistribuidora);
  clone.cargosDistribuidora = inv(clone.cargosDistribuidora);
  clone.alquilerEquipo = inv(clone.alquilerEquipo);
  clone.baseIEE = inv(clone.baseIEE);
  clone.taxElectric = inv(clone.taxElectric);
  clone.svaCost = inv(clone.svaCost);
  clone.cgBolsilloSolarCost = inv(clone.cgBolsilloSolarCost);
  clone.excesosPotencia = inv(clone.excesosPotencia);
  clone.capacitiveEnergyCost = inv(clone.capacitiveEnergyCost);
  clone.penalizacionNoIcpCost = inv(clone.penalizacionNoIcpCost);
  clone.recargoInfAnioCost = inv(clone.recargoInfAnioCost);
  clone.interesesDemoraCost = inv(clone.interesesDemoraCost);
  clone.conceptosRepercutiblesBase = inv(clone.conceptosRepercutiblesBase);
  clone.conceptosRepercutiblesExempt = inv(clone.conceptosRepercutiblesExempt);
  clone.excedentesAutoconsumo = inv(clone.excedentesAutoconsumo);
  clone.excedentesKwh = inv(clone.excedentesKwh);
  clone.powerCost = inv(clone.powerCost);
  clone.reactiveEnergyCost = inv(clone.reactiveEnergyCost);
  clone.maxExcedentes = inv(clone.maxExcedentes);
  clone.bolsilloSolarLlenado = inv(clone.bolsilloSolarLlenado);
  clone.bolsilloSolarUso = inv(clone.bolsilloSolarUso);
  clone.totalF1MWh = inv(clone.totalF1MWh);
  clone.totalCchMWh = inv(clone.totalCchMWh);

  if (clone.repairData) {
    clone.repairData.f1Volume = inv(clone.repairData.f1Volume);
    clone.repairData.cchVolume = inv(clone.repairData.cchVolume);
  }
  if (clone.periods) {
    for (const p in clone.periods) {
      clone.periods[p].energyCostEur = inv(clone.periods[p].energyCostEur);
      clone.periods[p].regulatedCostEur = inv(clone.periods[p].regulatedCostEur);
      clone.periods[p].cchConsumptionMWh = inv(clone.periods[p].cchConsumptionMWh);
      clone.periods[p].f1ConsumptionMWh = inv(clone.periods[p].f1ConsumptionMWh);
    }
  }
  if (clone.hourlyDetails) {
    for (const h of clone.hourlyDetails) {
      h.mwh = inv(h.mwh);
      h.hCost = inv(h.hCost);
      h.fnee = inv(h.fnee);
      if (h.surplusMwh !== undefined) h.surplusMwh = inv(h.surplusMwh);
      if (h.surplusPayout !== undefined) h.surplusPayout = inv(h.surplusPayout);
    }
  }
  if (clone.energyMarketDetails) {
    for (const m of clone.energyMarketDetails) {
      m.kwh = inv(m.kwh);
      m.total = inv(m.total);
    }
  }
  if (clone.energyAtrDetails) {
    for (const m of clone.energyAtrDetails) {
      m.kwh = inv(m.kwh);
      m.total = inv(m.total);
      m.cargoEur = inv(m.cargoEur);
      m.peajeEur = inv(m.peajeEur);
    }
  }
  if (clone.powerDetails) {
    for (const m of clone.powerDetails) {
      m.total = inv(m.total);
      m.cargoEur = inv(m.cargoEur);
      m.peajeEur = inv(m.peajeEur);
    }
  }
  if (clone.reactiveDetails) {
    for (const r of clone.reactiveDetails) {
      r.cost = inv(r.cost);
      r.kvarh = inv(r.kvarh);
      r.excessKvarh = inv(r.excessKvarh);
    }
  }
  if (clone.svaDetails) {
    for (const s of clone.svaDetails) {
      s.total = inv(s.total);
    }
  }
  if (clone.conceptosRepercutibles) {
    for (const c of clone.conceptosRepercutibles) {
      c.total = inv(c.total);
    }
  }
  if (clone.taxBreakdown) {
    for (const tb of clone.taxBreakdown) {
      tb.base = inv(tb.base);
      tb.amount = inv(tb.amount);
    }
  }

  return clone;
}

export class InternalBillingEngine {

  static async calculate(
    f1Id: string,
    forceRepair: boolean = false,
    returnHourlyDetails: boolean = false
  ): Promise<BillingCalculationResult> {

    const f1 = await prisma.f1Invoice.findUnique({
      where: { id: f1Id },
      include: {
        contract: {
          include: {
            product: true,
            AdditionalService: true,
            brand: { include: { company: true } }
          }
        },
        supplyPoint: {
          include: { client: true }
        }
      }
    });

    if (!f1 || !f1.contract || !f1.supplyPoint) {
      throw new Error("F1 must have contract and supply point");
    }

    const contract = f1.contract;
    const supplyPoint = f1.supplyPoint;
    const postalCode = (supplyPoint.postalCode || supplyPoint.sipsPostalCode || '').trim();
    const airTarifa = (contract.airtableData as any)?.Tarifa || (contract.airtableData as any)?.tarifa;
    const tariff = (Array.isArray(airTarifa) ? airTarifa[0] : airTarifa) || contract.product?.tariff || supplyPoint.tariff || '3.0TD';

    const jsonData = (f1.jsonData as any) || {};
    const isOtrasFacturas = f1.tipoDocumento === 'OtrasFacturas' || Boolean(jsonData?.DatosGeneralesOtrasFacturas && !jsonData?.DatosGeneralesFacturaATR);

    let isAbono = false;
    let isAbonoAproximado = false;
    let f1Ref = f1.numeroFactura;
    const datosGen = jsonData?.DatosGeneralesFacturaATR?.DatosGeneralesFactura
      || jsonData?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura
      || jsonData?.DatosGeneralesFactura;

    const rawTipoFactura = datosGen?.TipoFactura;
    const f1TipoFactura = String((Array.isArray(rawTipoFactura) ? rawTipoFactura[0] : rawTipoFactura) || 'N').trim().toUpperCase();

    if (datosGen && datosGen.TipoFactura) {
      const t = f1TipoFactura;
      if (t === 'S' || t === 'AR' || t === 'A') {
        isAbono = true;
        f1Ref = (Array.isArray(datosGen.CodigoFacturaRectificadaAnulada) ? datosGen.CodigoFacturaRectificadaAnulada[0] : datosGen.CodigoFacturaRectificadaAnulada) || f1Ref;

        // --- REVERSE ENGINEERING FOR AR / A / S INVOICES ---
        let originalNCode: string | null = (Array.isArray(datosGen.CodigoFacturaRectificadaAnulada)
          ? datosGen.CodigoFacturaRectificadaAnulada[0]
          : datosGen.CodigoFacturaRectificadaAnulada) || null;

        if (!originalNCode && supplyPoint.id) {
          const allR = await prisma.f1Invoice.findMany({
            where: { supplyPointId: supplyPoint.id }
          });
          for (const r of allR) {
            const rGen = (r.jsonData as any)?.DatosGeneralesFacturaATR?.DatosGeneralesFactura
              || (r.jsonData as any)?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura
              || (r.jsonData as any)?.DatosGeneralesFactura;
            const rOriginalCode = rGen?.CodigoFacturaRectificadaAnulada;
            const codAbono = rGen?.CodigoFacturaAbono || (rOriginalCode ? `AR-${rOriginalCode}` : undefined);
            if (codAbono === f1.numeroFactura) {
              originalNCode = rOriginalCode;
              break;
            }
          }
        }

        if (originalNCode) {
          const originalF1 = await prisma.f1Invoice.findFirst({
            where: {
              numeroFactura: String(originalNCode),
              ...(supplyPoint.id ? { supplyPointId: supplyPoint.id } : {})
            }
          }) || await prisma.f1Invoice.findFirst({ where: { numeroFactura: String(originalNCode) } });

          if (originalF1 && originalF1.id !== f1.id) {
            if (returnHourlyDetails) {
              // Para exportación Excel horaria, recalculamos la factura original con detalle horario e invertimos signos
              try {
                const origWithHourly = await InternalBillingEngine.calculate(originalF1.id, true, true);
                return invertBillingResult(origWithHourly);
              } catch {
                // Fallback a invoiceData persistido si falla el recálculo
              }
            }

            const internalInvoice = await prisma.internalInvoice.findFirst({
              where: { f1InvoiceId: originalF1.id },
              orderBy: { createdAt: 'desc' }
            });
            if (internalInvoice && internalInvoice.invoiceData) {
              const originalResult = JSON.parse(JSON.stringify(internalInvoice.invoiceData)) as BillingCalculationResult;
              originalResult.totalBase = originalResult.totalBase ?? internalInvoice.subtotal1 ?? 0;
              originalResult.taxAmount = originalResult.taxAmount ?? internalInvoice.taxAmount ?? 0;
              originalResult.totalAmount = originalResult.totalAmount ?? internalInvoice.totalAmount ?? 0;
              originalResult.totalF1MWh = originalResult.totalF1MWh ?? internalInvoice.totalMWh ?? 0;
              originalResult.feeCost = originalResult.feeCost ?? internalInvoice.margin ?? 0;
              return invertBillingResult(originalResult);
            } else {
              isAbonoAproximado = true;
            }
          } else {
            isAbonoAproximado = true;
          }
        } else {
          isAbonoAproximado = true;
        }
      }
    }

    // --- DETERMINACIÓN DE RÉGIMEN INDIRECTO TERRITORIAL (IVA / IGIC / IPSI) ---
    const provLower = (supplyPoint.province || '').toLowerCase();
    const isCanarias = postalCode.startsWith('35') || postalCode.startsWith('38')
      || provLower.includes('palmas') || provLower.includes('tenerife');
    const isCeutaMelilla = postalCode.startsWith('51') || postalCode.startsWith('52')
      || provLower.includes('ceuta') || provLower.includes('melilla');

    const clientVat = (supplyPoint.client?.vatNumber || '').trim().toUpperCase();
    const f1TipoPersona = jsonData?.DatosGeneralesFacturaATR?.Cliente?.TipoPersona
      || jsonData?.DatosGeneralesOtrasFacturas?.Cliente?.TipoPersona;
    const isPhysicalPerson = f1TipoPersona === 'F' || /^[0-9XYZKLM]/.test(clientVat);

    // --- EXTRACCIÓN DE VOLÚMENES Y LECTURAS DEL F1 ---
    const shiftIsoDatePlusOneDay = (isoDate: string): string => {
      const clean = isoDate.trim().substring(0, 10);
      const [y, m, d] = clean.split('-').map(Number);
      if (!y || !m || !d) return clean;
      return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().substring(0, 10);
    };

    const termActiva = getArray(jsonData?.EnergiaActiva?.TerminoEnergiaActiva);

    const f1VolumesByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    const f1SubBlocksActiva: {
      fechaDesde?: string;
      fechaHasta?: string;
      startIso?: string;
      endExclusiveIso?: string;
      volumesMWh: Record<string, number>;
    }[] = [];
    let totalF1MWh = 0;

    const f1Readings: Record<string, any> = {};
    for (let i = 1; i <= 6; i++) {
      f1Readings[`P${i}`] = { actIni: '-', actFin: '-', reactIni: '-', reactFin: '-', reactCons: 0, actCons: 0, max: 0 };
    }

    if (termActiva.length > 0) {
      for (const t of termActiva) {
        const blockVols: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
        const pEnergia = getArray(t?.Periodo);
        for (let idx = 0; idx < pEnergia.length; idx++) {
          const p = pEnergia[idx];
          const pName = p.Periodo || p.periodo || `P${idx + 1}`;
          let kwh = parseXmlNum(p.ValorEnergiaActiva ?? p.valorEnergiaActiva);
          if (isAbono) kwh = Math.abs(kwh);
          const valorMWh = kwh / 1000.0;
          if (f1VolumesByPeriod[pName] !== undefined) {
            f1VolumesByPeriod[pName] += valorMWh;
            blockVols[pName] += valorMWh;
          }
          totalF1MWh += valorMWh;
          if (f1Readings[pName]) {
            f1Readings[pName].actCons += kwh;
          }
        }
        // En CNMC (Regla 170), FechaDesde y FechaHasta del XML indican cierre de día de lectura:
        // ej. FechaDesde="2025-12-31", FechaHasta="2026-05-07" => consumo real desde 2026-01-01 00:00 hasta 2026-05-08 00:00
        const rawDesde = typeof t?.FechaDesde === 'string' && t.FechaDesde.length >= 10 ? t.FechaDesde.substring(0, 10) : undefined;
        const rawHasta = typeof t?.FechaHasta === 'string' && t.FechaHasta.length >= 10 ? t.FechaHasta.substring(0, 10) : undefined;
        let startIso: string | undefined = undefined;
        let endExclusiveIso: string | undefined = undefined;
        if (rawDesde && rawHasta) {
          startIso = rawHasta > rawDesde ? shiftIsoDatePlusOneDay(rawDesde) : rawDesde;
          endExclusiveIso = shiftIsoDatePlusOneDay(rawHasta);
        } else if (rawDesde) {
          startIso = shiftIsoDatePlusOneDay(rawDesde);
        }
        f1SubBlocksActiva.push({
          fechaDesde: t?.FechaDesde,
          fechaHasta: t?.FechaHasta,
          startIso,
          endExclusiveIso,
          volumesMWh: blockVols
        });
      }
    }

    const termExcedentaria = getArray(jsonData?.Autoconsumo?.EnergiaExcedentaria?.TerminoEnergiaExcedentaria);
    const f1SurplusVolumesByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    let totalF1SurplusMWh = 0;
    if (termExcedentaria.length > 0) {
      for (const t of termExcedentaria) {
        const pExcedentaria = getArray(t?.Periodo);
        for (let idx = 0; idx < pExcedentaria.length; idx++) {
          const p = pExcedentaria[idx];
          const pName = p.Periodo || p.periodo || `P${idx + 1}`;
          let kwh = parseXmlNum(p.ValorEnergiaExcedentaria ?? p.valorEnergiaExcedentaria);
          if (isAbono) kwh = Math.abs(kwh);
          const valorMWh = kwh / 1000.0;
          if (f1SurplusVolumesByPeriod[pName] !== undefined) {
            f1SurplusVolumesByPeriod[pName] += valorMWh;
          }
          totalF1SurplusMWh += valorMWh;
        }
      }
    }

    const termReactiva = getArray(jsonData?.EnergiaReactiva?.TerminoEnergiaReactiva);
    if (termReactiva.length > 0) {
      for (const t of termReactiva) {
        const pReactiva = getArray(t?.Periodo);
        for (let idx = 0; idx < pReactiva.length; idx++) {
          const p = pReactiva[idx];
          const pName = p.Periodo || p.periodo || `P${idx + 1}`;
          if (pName && f1Readings[pName]) {
            let val = parseXmlNum(p.ValorEnergiaReactiva ?? p.valorEnergiaReactiva);
            if (isAbono) val = Math.abs(val);
            f1Readings[pName].reactCons += val;
          }
        }
      }
    }

    // Lectura correcta de Potencia.TerminoPotencia (Facturacion.xsd) con fallback plural legacy
    const termPotenciaList = getArray(jsonData?.Potencia?.TerminoPotencia || jsonData?.Potencias?.TerminosPotencia);
    const f1PotenciaAFacturarMax: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    const f1PotenciaContratadaMax: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    let maxRecargoInfAnioPct = 0;

    if (termPotenciaList.length > 0) {
      for (const t of termPotenciaList) {
        const pMax = getArray(t?.Periodo);
        for (let idx = 0; idx < pMax.length; idx++) {
          const p = pMax[idx];
          const pName = p.Periodo || p.periodo || `P${idx + 1}`;
          if (pName && f1Readings[pName]) {
            const maxKw = Math.abs(parseCnmcPowerKw(p.PotenciaMaxDemandada ?? p.potenciaMaxDemandada ?? p.PotenciaMaxima ?? p.potenciaMaxima, p.PrecioPotencia));
            const contrKw = Math.abs(parseCnmcPowerKw(p.PotenciaContratada ?? p.potenciaContratada, p.PrecioPotencia));
            const factKw = Math.abs(parseCnmcPowerKw(p.PotenciaAFacturar ?? p.potenciaAFacturar, p.PrecioPotencia));
            f1Readings[pName].max = Math.max(f1Readings[pName].max, maxKw);
            f1PotenciaContratadaMax[pName] = Math.max(f1PotenciaContratadaMax[pName], contrKw);
            f1PotenciaAFacturarMax[pName] = Math.max(f1PotenciaAFacturarMax[pName], factKw);
            const recPct = Math.abs(parseXmlNum(p.RecargoInfAnio));
            if (recPct > maxRecargoInfAnioPct) maxRecargoInfAnioPct = recPct;
          }
        }
      }
    }

    const f1ImportePotenciaXml = Math.abs(
      parseXmlNum(
        jsonData?.Potencia?.ImporteTotalTerminoPotencia ??
        jsonData?.Potencia?.ImporteTotalPotencia ??
        jsonData?.Potencias?.ImporteTotalTerminoPotencia
      )
    );
    const sumF1AFacturarPower = Object.values(f1PotenciaAFacturarMax).reduce((acc, v) => acc + v, 0);
    const sumF1ContratadaPowerInit = Object.values(f1PotenciaContratadaMax).reduce((acc, v) => acc + v, 0);
    const hasF1PowerBilling =
      termPotenciaList.length > 0 &&
      (sumF1AFacturarPower > 0 || sumF1ContratadaPowerInit > 0 || f1ImportePotenciaXml > 0);
    // En facturas Complementarias ('C') sin bloque <Potencia> (inspección/fraude o recuperación de energía omitida),
    // la potencia contratada y los cargos fijos diarios (Bono Social, SVA, CG Bolsillo Solar) ya se facturaron
    // en las facturas ordinarias mensuales ('N') que cubrieron ese rango de fechas.
    const skipDailyAndPowerCharges = f1TipoFactura === 'C' && !hasF1PowerBilling;

    // Extraer lecturas reales y Número de Serie del Contador desde Medidas
    let meterSerialNumber = '';
    const arrFacturasATR = getArray(jsonData?.Facturas?.FacturaATR);
    const medidasList = getArray(jsonData?.Medidas || arrFacturasATR?.[0]?.Medidas);
    for (const med of medidasList) {
      const modelos = getArray(med?.ModeloAparato);
      for (const mod of modelos) {
        if (!meterSerialNumber && mod?.NumeroSerie !== undefined && mod?.NumeroSerie !== null) {
          meterSerialNumber = String(mod.NumeroSerie).trim();
        }
        const integradores = getArray(mod?.Integrador);
        for (const intg of integradores) {
          const mag = intg.Magnitud;
          const cod = intg.CodigoPeriodo?.toString();

          let pName = '';
          if (cod && cod.length > 0) {
            const lastChar = cod.substring(cod.length - 1);
            if (['1', '2', '3', '4', '5', '6'].includes(lastChar)) {
              pName = `P${lastChar}`;
            }
          }

          if (pName && f1Readings[pName]) {
            const lDesde = intg.LecturaDesde?.Lectura ?? intg.lecturaDesde?.lectura;
            const lHasta = intg.LecturaHasta?.Lectura ?? intg.lecturaHasta?.lectura;
            const consCalc = intg.ConsumoCalculado ?? intg.consumoCalculado;

            if (mag === 'AE' || mag === '1') {
              if (lDesde !== undefined) f1Readings[pName].actIni = lDesde.toString();
              if (lHasta !== undefined) f1Readings[pName].actFin = lHasta.toString();
              // Solo sobrescribimos actCons si no venía agregado en múltiples bloques TerminoEnergiaActiva (ej. Tipo G)
              if (consCalc !== undefined && termActiva.length <= 1) {
                let val = parseXmlNum(consCalc);
                if (isAbono) val = Math.abs(val);
                f1Readings[pName].actCons = val;
              }
            } else if (mag === 'R1' || mag === '2') {
              if (lDesde !== undefined) f1Readings[pName].reactIni = lDesde.toString();
              if (lHasta !== undefined) f1Readings[pName].reactFin = lHasta.toString();
              if (consCalc !== undefined && termReactiva.length <= 1) {
                let val = parseXmlNum(consCalc);
                if (isAbono) val = Math.abs(val);
                f1Readings[pName].reactCons = val;
              }
            } else if (mag === 'PM' || mag === '3') {
              let val = consCalc !== undefined ? parseXmlNum(consCalc) : (lHasta !== undefined ? parseXmlNum(lHasta) : 0);
              if (isAbono) val = Math.abs(val);
              if (val > 1000) val = val / 1000.0;
              if (val > 0) f1Readings[pName].max = Math.max(f1Readings[pName].max, val);
            }
          }
        }
      }
    }
    if (meterSerialNumber) {
      f1Readings.NumeroSerie = meterSerialNumber;
    }

    // --- EXTRACCIÓN DE CONCEPTOS REPERCUTIBLES E INTERESES (Tabla 103 & Tabla 114 CNMC) ---
    const rawRepercutibles = getArray(jsonData?.ConceptoRepercutible);
    const conceptosRepercutibles: ConceptoRepercutibleItem[] = [];
    let conceptosRepercutiblesBase = 0; // Sujetos a IVA/IGIC/IPSI (TipoImpositivo 1 o 2)
    let conceptosRepercutiblesExempt = 0; // Exentos (TipoImpositivo 3: ej. fianzas/depósitos/indemnizaciones)
    const nonRepercutibleAlerts: string[] = [];

    for (const cr of rawRepercutibles) {
      const codeRaw = (cr?.ConceptoRepercutible ?? '').toString().trim().padStart(2, '0');
      let importe = parseXmlNum(cr?.ImporteTotalConceptoRepercutible);
      if (isAbono) importe = Math.abs(importe); // Se invertirá al final junto al resto si procede

      if (NON_REPERCUTIBLE_E2_CODES.has(codeRaw)) {
        if (importe !== 0) {
          nonRepercutibleAlerts.push(`Concepto ${codeRaw} (${importe.toFixed(2)} €) de reposición E2 no repercutible al cliente según CNMC.`);
        }
        continue;
      }
      if (INFORMATIONAL_AUTOCONSUMO_CODES.has(codeRaw) && importe === 0) {
        continue;
      }
      if (importe === 0) continue;

      const taxTypeCode = (cr?.TipoImpositivoConceptoRepercutible ?? '1').toString().trim();
      const units = parseXmlNum(cr?.UnidadesConceptoRepercutible) || 1;
      const unitPrice = parseXmlNum(cr?.PrecioUnidadConceptoRepercutible) || round2(importe / (units || 1));
      const baseDesc = TABLA_103_CONCEPTOS[codeRaw] || `Concepto distribuidora (${codeRaw})`;
      const extraComment = cr?.Comentarios ? ` - ${String(cr.Comentarios).trim().slice(0, 80)}` : '';
      const roundedImp = round2(importe);

      conceptosRepercutibles.push({
        code: codeRaw,
        description: `${baseDesc}${extraComment}`,
        units,
        unitPrice,
        total: roundedImp,
        taxTypeCode
      });

      if (taxTypeCode === '3') {
        conceptosRepercutiblesExempt = round2(conceptosRepercutiblesExempt + roundedImp);
      } else {
        conceptosRepercutiblesBase = round2(conceptosRepercutiblesBase + roundedImp);
      }
    }

    let interesesDemoraCost = Math.abs(parseXmlNum(jsonData?.ImporteIntereses));
    interesesDemoraCost = round2(interesesDemoraCost);
    if (interesesDemoraCost > 0) {
      conceptosRepercutiblesExempt = round2(conceptosRepercutiblesExempt + interesesDemoraCost);
    }

    // --- CASO ESPECIAL: <OtrasFacturas> (Facturas aisladas de derechos de enganche/acometida/verificación/fianza) ---
    if (isOtrasFacturas) {
      const taxType: 'IVA' | 'IGIC' | 'IPSI' = isCanarias ? 'IGIC' : (isCeutaMelilla ? 'IPSI' : 'IVA');
      const f1IvaPct = parseXmlNum(getArray(jsonData?.IVA)?.[0]?.Porcentaje);
      const defaultRate = isCanarias ? (f1IvaPct || 7) : (isCeutaMelilla ? (f1IvaPct || 4) : 21);
      const totalBase = round2(conceptosRepercutiblesBase);
      const taxAmount = round2(totalBase * (defaultRate / 100.0));
      const totalSinDescuentoBolsillo = round2(totalBase + taxAmount + conceptosRepercutiblesExempt);
      const otrasResult: BillingCalculationResult = {
        hasMismatch: false,
        hasCriticalError: false,
        mismatchReason: nonRepercutibleAlerts.length > 0 ? nonRepercutibleAlerts.join(' | ') : undefined,
        totalCchMWh: 0,
        totalF1MWh: 0,
        billingDays: 0,
        periods: {},
        energyCost: 0,
        feeCost: 0,
        capacityCost: 0,
        fneeCost: 0,
        bonoSocial: 0,
        powerCost: 0,
        peajesDistribuidora: 0,
        cargosDistribuidora: 0,
        totalBase,
        taxType,
        taxPercentage: defaultRate,
        taxAmount,
        taxBreakdown: totalBase !== 0 ? [{ taxType, rate: defaultRate, base: totalBase, amount: taxAmount, label: `${defaultRate}% ${taxType}` }] : [],
        totalSinDescuentoBolsillo,
        totalAmount: totalSinDescuentoBolsillo,
        alquilerEquipo: 0,
        baseIEE: 0,
        taxElectric: 0,
        conceptosRepercutibles,
        conceptosRepercutiblesBase,
        conceptosRepercutiblesExempt,
        interesesDemoraCost,
        hourlyDetails: [],
        reactiveEnergyCost: 0,
        reactiveDetails: [],
        repairData: nonRepercutibleAlerts.length > 0 ? { issue: nonRepercutibleAlerts.join(' | '), f1Volume: 0, cchVolume: 0 } : null,
        powerDetails: [],
        energyAtrDetails: [],
        energyMarketDetails: [],
        energyMargin: 0,
        powerMargin: 0,
        f1Readings,
        meterSerialNumber,
        isFixed: true,
        isOtrasFacturas: true
      };
      return isAbono ? invertBillingResult(otrasResult) : otrasResult;
    }

    // --- FECHAS Y DÍAS DE FACTURACIÓN (Inmunes a desfase UTC 22:00Z / 23:00Z y a cambios de hora DST) ---
    const f1StartDate = f1.fechaInicio || new Date();
    const f1StartIsoStr = f1StartDate.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
    const startDate = fromZonedTime(`${f1StartIsoStr}T00:00:00`, 'Europe/Madrid');

    const f1EndDate = f1.fechaFin || new Date();
    const f1EndIsoStr = f1EndDate.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
    const endDate = fromZonedTime(`${f1EndIsoStr}T00:00:00`, 'Europe/Madrid');

    const f1XmlNumeroDias = Math.round(parseXmlNum(jsonData?.DatosGeneralesFacturaATR?.DatosFacturaATR?.Periodo?.NumeroDias));
    const calendarDiffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    const billingDays = Math.max(1, calendarDiffDays > 0 ? calendarDiffDays : (f1XmlNumeroDias || 1));

    const baseCups = supplyPoint.cups.substring(0, 20);
    const actualEndDate = new Date(endDate.getTime() - 1000);

    const loadCurves = await prisma.loadCurve.findMany({
      where: {
        cups: { startsWith: baseCups },
        date: {
          gte: new Date(startDate.getTime() - 24 * 3600 * 1000),
          lte: new Date(actualEndDate.getTime() + 24 * 3600 * 1000)
        }
      },
      orderBy: { date: 'asc' }
    });

    const consumptionCurves = loadCurves.filter(c => c.type === 'CONSUMPTION');
    const surplusCurves = loadCurves.filter(c => c.type === 'SURPLUS');

    const cchHourlyMWh: { date: Date; mwh: number; period: string; isQuarterHour: boolean }[] = [];
    let totalCchMWh = 0;
    const cchVolumesByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };

    for (const lc of consumptionCurves) {
      const isQuarter = lc.readings.length === 96;
      const dateIsoStr = lc.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);

      if (isQuarter) {
        for (let q = 0; q < 96; q++) {
          const localStr = `${dateIsoStr}T${String(Math.floor(q / 4)).padStart(2, '0')}:${String((q % 4) * 15).padStart(2, '0')}:00`;
          const qDate = fromZonedTime(localStr, 'Europe/Madrid');
          if (qDate < startDate || qDate >= endDate) continue;

          const mwh = (lc.readings[q] || 0) / 1000.0;
          const period = getPeriodoREE(qDate, tariff, postalCode);
          cchHourlyMWh.push({ date: qDate, mwh, period, isQuarterHour: true });
          totalCchMWh += mwh;
          if (cchVolumesByPeriod[period] !== undefined) cchVolumesByPeriod[period] += mwh;
        }
      } else {
        for (let h = 0; h < 24; h++) {
          const mwhHour = (lc.readings[h] || 0) / 1000.0;
          const mwhQuarter = mwhHour / 4.0;
          for (let q = 0; q < 4; q++) {
            const localStr = `${dateIsoStr}T${String(h).padStart(2, '0')}:${String(q * 15).padStart(2, '0')}:00`;
            const hourDate = fromZonedTime(localStr, 'Europe/Madrid');
            if (hourDate < startDate || hourDate >= endDate) continue;

            const period = getPeriodoREE(hourDate, tariff, postalCode);
            cchHourlyMWh.push({ date: hourDate, mwh: mwhQuarter, period, isQuarterHour: true });
            totalCchMWh += mwhQuarter;
            if (cchVolumesByPeriod[period] !== undefined) cchVolumesByPeriod[period] += mwhQuarter;
          }
        }
      }
    }

    const cchSurplusHourlyMWh: { date: Date; mwh: number; period: string; isQuarterHour: boolean }[] = [];
    let totalCchSurplusMWh = 0;
    const cchSurplusVolumesByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };

    for (const lc of surplusCurves) {
      const isQuarter = lc.readings.length === 96;
      const dateIsoStr = lc.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);

      if (isQuarter) {
        for (let q = 0; q < 96; q++) {
          const localStr = `${dateIsoStr}T${String(Math.floor(q / 4)).padStart(2, '0')}:${String((q % 4) * 15).padStart(2, '0')}:00`;
          const qDate = fromZonedTime(localStr, 'Europe/Madrid');
          if (qDate < startDate || qDate >= endDate) continue;

          const mwh = (lc.readings[q] || 0) / 1000.0;
          const period = getPeriodoREE(qDate, tariff, postalCode);
          cchSurplusHourlyMWh.push({ date: qDate, mwh, period, isQuarterHour: true });
          totalCchSurplusMWh += mwh;
          if (cchSurplusVolumesByPeriod[period] !== undefined) cchSurplusVolumesByPeriod[period] += mwh;
        }
      } else {
        for (let h = 0; h < 24; h++) {
          const mwhHour = (lc.readings[h] || 0) / 1000.0;
          const mwhQuarter = mwhHour / 4.0;
          for (let q = 0; q < 4; q++) {
            const localStr = `${dateIsoStr}T${String(h).padStart(2, '0')}:${String(q * 15).padStart(2, '0')}:00`;
            const hourDate = fromZonedTime(localStr, 'Europe/Madrid');
            if (hourDate < startDate || hourDate >= endDate) continue;

            const period = getPeriodoREE(hourDate, tariff, postalCode);
            cchSurplusHourlyMWh.push({ date: hourDate, mwh: mwhQuarter, period, isQuarterHour: true });
            totalCchSurplusMWh += mwhQuarter;
            if (cchSurplusVolumesByPeriod[period] !== undefined) cchSurplusVolumesByPeriod[period] += mwhQuarter;
          }
        }
      }
    }

    // --- EVALUACIÓN DE DESCUADRE CCH vs F1 ---
    const originalCchMWh = totalCchMWh;
    const allowedEnergyMargin = 0.001;
    const foundDays = new Set(cchHourlyMWh.map(c => c.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10))).size;
    const expectedDays = billingDays;

    let hasMismatch = false;
    let hasCriticalError = false;
    let mismatchReason: string | undefined = undefined;

    if (foundDays < expectedDays && expectedDays > 0) {
      hasMismatch = true;
      mismatchReason = `Descuadre de días: El F1 factura ${expectedDays} días pero la curva (CCH) solo tiene datos de ${foundDays} días.`;
    } else if (Math.abs(totalF1MWh - totalCchMWh) > allowedEnergyMargin) {
      hasMismatch = true;
      mismatchReason = `Descuadre de volumen total: F1 dice ${(totalF1MWh * 1000).toFixed(0)} kWh pero la Curva suma ${(totalCchMWh * 1000).toFixed(0)} kWh`;
    } else {
      for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
        if (f1VolumesByPeriod[p] > 0 || cchVolumesByPeriod[p] > 0) {
          if (Math.abs(f1VolumesByPeriod[p] - cchVolumesByPeriod[p]) > allowedEnergyMargin) {
            hasMismatch = true;
            mismatchReason = `Descuadre en ${p}: F1 dice ${(f1VolumesByPeriod[p] * 1000).toFixed(0)} kWh pero CCH suma ${(cchVolumesByPeriod[p] * 1000).toFixed(0)} kWh`;
            break;
          }
        }
      }
    }

    let hasSurplusMismatch = false;
    if (totalF1SurplusMWh > 0) {
      if (cchSurplusHourlyMWh.length === 0) {
        hasMismatch = true;
        hasSurplusMismatch = true;
        const msg = 'Sin datos de curva de excedentes (CCH) en BD.';
        mismatchReason = mismatchReason ? `${mismatchReason} | ${msg}` : msg;
      } else if (Math.abs(totalF1SurplusMWh - totalCchSurplusMWh) > allowedEnergyMargin) {
        hasMismatch = true;
        hasSurplusMismatch = true;
        const msg = `Descuadre de excedentes: F1 dice ${(totalF1SurplusMWh * 1000).toFixed(0)} kWh pero la CCH Excedentes suma ${(totalCchSurplusMWh * 1000).toFixed(0)} kWh`;
        mismatchReason = mismatchReason ? `${mismatchReason} | ${msg}` : msg;
      }
    }

    if (consumptionCurves.length === 0 && totalF1MWh > 0) {
      hasMismatch = true;
      const msg = 'Sin datos de curva de consumo (CCH) en BD.';
      mismatchReason = mismatchReason ? `${mismatchReason} | ${msg}` : msg;
    }

    if (isAbonoAproximado) {
      const msg = "⚠️ ABONO APROXIMADO: Factura original no encontrada en BD. Cálculo por aproximación.";
      mismatchReason = mismatchReason ? `${mismatchReason} | ${msg}` : msg;
    }

    for (const alertMsg of nonRepercutibleAlerts) {
      mismatchReason = mismatchReason ? `${mismatchReason} | ${alertMsg}` : alertMsg;
    }

    let originalMismatchReason = mismatchReason;

    if (hasMismatch && !forceRepair) {
      return {
        totalBase: 0,
        taxAmount: 0,
        totalAmount: 0,
        totalCchMWh,
        totalF1MWh,
        energyCost: 0,
        capacityCost: 0,
        fneeCost: 0,
        powerCost: 0,
        bonoSocial: 0,
        feeCost: 0,
        peajesDistribuidora: 0,
        cargosDistribuidora: 0,
        reactiveEnergyCost: 0,
        reactiveDetails: [],
        hourlyDetails: [],
        hasMismatch: true,
        hasCriticalError: false,
        mismatchReason,
        periods: {},
        repairData: {
          issue: mismatchReason,
          f1Volume: totalF1MWh,
          cchVolume: totalCchMWh,
          f1Id
        }
      };
    }

    // --- CARGA DE PERFILES REE (Para consumo y pSolar de excedentes) ---
    const startYear = parseInt(f1StartIsoStr.substring(0, 4), 10);
    const endYear = parseInt(f1EndIsoStr.substring(0, 4), 10);
    const yearsToLoad = Array.from(new Set([startYear, endYear]));

    let reeProfiles = await prisma.reeProfile.findMany({
      where: { year: { in: yearsToLoad } }
    });
    if (reeProfiles.length === 0) {
      const lastYear = await prisma.reeProfile.findFirst({ orderBy: { year: 'desc' } });
      if (lastYear) {
        reeProfiles = await prisma.reeProfile.findMany({ where: { year: lastYear.year } });
      }
    }

    // Indexar perfiles REE en un Map O(1) en lugar de .find() O(N) sobre 8760 filas por cuarto de hora
    const reeProfileMap = new Map<string, any>();
    for (const rp of reeProfiles) {
      reeProfileMap.set(`${rp.year}_${rp.month}_${rp.day}_${rp.hour}`, rp);
      if (!reeProfileMap.has(`ANY_${rp.month}_${rp.day}_${rp.hour}`)) {
        reeProfileMap.set(`ANY_${rp.month}_${rp.day}_${rp.hour}`, rp);
      }
    }

    const tipoPerfil = tariff.includes('2.0') ? 'p20td' : (tariff.includes('3.0TDVE') ? 'p30tdve' : 'p30td');
    const getCoef = (d: Date, isSurplus: boolean = false): number => {
      const localStr = d.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
      const yr = parseInt(localStr.substring(0, 4), 10);
      const m = parseInt(localStr.substring(5, 7), 10);
      const dom = parseInt(localStr.substring(8, 10), 10);
      let h = parseInt(localStr.substring(11, 13), 10);
      if (h === 0) h = 24;
      const prof = reeProfileMap.get(`${yr}_${m}_${dom}_${h}`) || reeProfileMap.get(`ANY_${m}_${dom}_${h}`);
      if (!prof) return 0.0001;
      const key = isSurplus ? 'pSolar' : tipoPerfil;
      const val = (prof as any)[key];
      return val !== null && val !== undefined ? val : 0.0001;
    };

    // --- REPARACIÓN / PERFILADO DE CURVA DE CONSUMO (Reglas 172) ---
    const repairWindowQuarters = (
      winStart: Date,
      winEnd: Date,
      targetVols: Record<string, number>,
      existingItems: { date: Date; mwh: number; period: string; isQuarterHour: boolean }[]
    ): { date: Date; mwh: number; period: string; isQuarterHour: boolean }[] => {
      const winTotalMWh = Object.values(targetVols).reduce((a, b) => a + b, 0);
      if (winTotalMWh <= 0) {
        return existingItems.map(item => ({ ...item, mwh: 0 }));
      }
      if (existingItems.length === 0) {
        const ms = winEnd.getTime() - winStart.getTime();
        const totalQuarters = Math.ceil(ms / (1000 * 60 * 15)) || 1;
        const tempQuarters: { date: Date; period: string; coef: number }[] = [];
        const sumCoefByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };

        for (let i = 0; i < totalQuarters; i++) {
          const d = new Date(winStart.getTime() + i * 15 * 60 * 1000);
          const p = getPeriodoREE(d, tariff, postalCode);
          const coef = getCoef(d, false);
          sumCoefByPeriod[p] += coef;
          tempQuarters.push({ date: d, period: p, coef });
        }

        return tempQuarters.map(tq => {
          const targetMWhPeriod = targetVols[tq.period] || 0;
          const sumCoef = sumCoefByPeriod[tq.period];
          const mwh = sumCoef > 0 ? targetMWhPeriod * (tq.coef / sumCoef) : 0;
          return { date: tq.date, mwh, period: tq.period, isQuarterHour: true };
        });
      }

      const workItems = existingItems.map(item => ({ ...item }));
      const periodsMissingQuarters = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].filter(
        p => (targetVols[p] || 0) > 0 && !workItems.some(c => c.period === p)
      );
      if (periodsMissingQuarters.length > 0) {
        const existingTimestamps = new Set(workItems.map(c => c.date.getTime()));
        const totalQuarters = Math.ceil((winEnd.getTime() - winStart.getTime()) / (1000 * 60 * 15)) || 1;
        for (let i = 0; i < totalQuarters; i++) {
          const d = new Date(winStart.getTime() + i * 15 * 60 * 1000);
          if (existingTimestamps.has(d.getTime())) continue;
          const p = getPeriodoREE(d, tariff, postalCode);
          if (periodsMissingQuarters.includes(p)) {
            workItems.push({ date: d, mwh: 0, period: p, isQuarterHour: true });
          }
        }
        workItems.sort((a, b) => a.date.getTime() - b.date.getTime());
      }

      const winCchVols: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
      const sumCoefByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
      const quarterCoefs = new Array(workItems.length);

      for (let i = 0; i < workItems.length; i++) {
        const c = workItems[i];
        winCchVols[c.period] = (winCchVols[c.period] || 0) + c.mwh;
        const coef = getCoef(c.date, false);
        quarterCoefs[i] = coef;
        sumCoefByPeriod[c.period] += coef;
      }

      for (let i = 0; i < workItems.length; i++) {
        const c = workItems[i];
        const p = c.period;
        const f1Vol = targetVols[p] || 0;
        const cchVol = winCchVols[p] || 0;

        if (f1Vol === 0) {
          c.mwh = 0;
        } else if (cchVol > 0) {
          c.mwh = c.mwh * (f1Vol / cchVol);
        } else {
          const sumCoef = sumCoefByPeriod[p];
          c.mwh = sumCoef > 0 ? f1Vol * (quarterCoefs[i] / sumCoef) : 0;
        }
      }

      return workItems;
    };

    const hasValidMultiSubBlocks =
      f1SubBlocksActiva.length > 1 &&
      f1SubBlocksActiva.every(b => Boolean(b.startIso && b.endExclusiveIso));

    const needsConsumptionRepair = (hasMismatch && forceRepair) || (cchHourlyMWh.length === 0 && totalF1MWh > 0);
    if (needsConsumptionRepair) {
      if (hasValidMultiSubBlocks) {
        const origItems = [...cchHourlyMWh];
        cchHourlyMWh.length = 0;
        for (const blk of f1SubBlocksActiva) {
          let blkStart = fromZonedTime(`${blk.startIso}T00:00:00`, 'Europe/Madrid');
          let blkEnd = fromZonedTime(`${blk.endExclusiveIso}T00:00:00`, 'Europe/Madrid');
          if (blkStart < startDate) blkStart = startDate;
          if (blkEnd > endDate) blkEnd = endDate;
          if (blkEnd <= blkStart) continue;
          const subExisting = origItems.filter(q => q.date >= blkStart && q.date < blkEnd);
          const repairedSub = repairWindowQuarters(blkStart, blkEnd, blk.volumesMWh, subExisting);
          for (const item of repairedSub) cchHourlyMWh.push(item);
        }
        cchHourlyMWh.sort((a, b) => a.date.getTime() - b.date.getTime());
      } else {
        const repairedAll = repairWindowQuarters(startDate, endDate, f1VolumesByPeriod, cchHourlyMWh);
        cchHourlyMWh.length = 0;
        for (const item of repairedAll) cchHourlyMWh.push(item);
      }

      totalCchMWh = totalF1MWh;
      hasMismatch = false;
      mismatchReason = undefined;
    }

    // --- REPARACIÓN / PERFILADO GLOBAL DE EXCEDENTES (Reglas 173 y 174) ---
    if ((hasSurplusMismatch && forceRepair) || (cchSurplusHourlyMWh.length === 0 && totalF1SurplusMWh > 0)) {
      if (cchSurplusHourlyMWh.length === 0) {
        const ms = endDate.getTime() - startDate.getTime();
        const totalQuarters = Math.ceil(ms / (1000 * 60 * 15)) || 1;
        const tempQuarters: { date: Date; period: string; coef: number }[] = [];
        let totalSumCoef = 0;

        for (let i = 0; i < totalQuarters; i++) {
          const d = new Date(startDate.getTime() + i * 15 * 60 * 1000);
          const p = getPeriodoREE(d, tariff, postalCode);
          const coef = getCoef(d, true);
          totalSumCoef += coef;
          tempQuarters.push({ date: d, period: p, coef });
        }

        for (const tq of tempQuarters) {
          const mwh = totalSumCoef > 0 ? totalF1SurplusMWh * (tq.coef / totalSumCoef) : 0;
          cchSurplusHourlyMWh.push({ date: tq.date, mwh, period: tq.period, isQuarterHour: true });
        }
      } else {
        const factor = totalCchSurplusMWh > 0 ? totalF1SurplusMWh / totalCchSurplusMWh : 0;
        for (let i = 0; i < cchSurplusHourlyMWh.length; i++) {
          cchSurplusHourlyMWh[i].mwh *= factor;
        }
      }
      totalCchSurplusMWh = totalF1SurplusMWh;
    }

    // --- PRECIOS HORARIOS DE MERCADO (SystemComponentPrice) ---
    const datesSet = new Set<string>();
    for (const c of cchHourlyMWh) {
      datesSet.add(c.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10));
    }
    for (const s of cchSurplusHourlyMWh) {
      datesSet.add(s.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10));
    }
    const datesToQueryStr = Array.from(datesSet);

    const individualComps = ['RT3', 'RT6', 'CT2', 'CT3', 'BS3', 'RAD3', 'RAD1', 'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP', 'MI', 'SECX'];
    const perdComponentName = tariff.includes('2.0') ? 'PERD_20TD' : (tariff.includes('6.1') ? 'PERD_61TD' : 'PERD_30TD');

    const priceData = datesToQueryStr.length > 0
      ? await prisma.systemComponentPrice.findMany({
          where: {
            date: { in: datesToQueryStr.map(d => new Date(`${d}T00:00:00Z`)) },
            component: { in: ['OMIE', ...individualComps, 'K', perdComponentName] }
          }
        })
      : [];

    const omieMap = new Map<string, number>();
    const kMap = new Map<string, number>();
    const perdMap = new Map<string, number>();
    const compMaps: Record<string, Map<string, number>> = {};
    for (const c of individualComps) {
      compMaps[c] = new Map<string, number>();
    }

    for (const pd of priceData) {
      const dateKey = pd.date.toISOString().split('T')[0];
      const isQuarterly = pd.values.length >= 96;
      const numVals = isQuarterly ? 96 : 24;

      for (let i = 0; i < numVals; i++) {
        const val = pd.values[i] || 0;
        if (isQuarterly) {
          const h = Math.floor(i / 4);
          const m = (i % 4) * 15;
          const key = `${dateKey}_${h}_${m}`;
          if (pd.component === 'OMIE') omieMap.set(key, val);
          else if (pd.component === 'K') kMap.set(key, pd.values[i] || 1);
          else if (individualComps.includes(pd.component)) compMaps[pd.component].set(key, val);
          else perdMap.set(key, val);
        } else {
          for (let q = 0; q < 4; q++) {
            const key = `${dateKey}_${i}_${q * 15}`;
            if (pd.component === 'OMIE') omieMap.set(key, val);
            else if (pd.component === 'K') kMap.set(key, pd.values[i] || 1);
            else if (individualComps.includes(pd.component)) compMaps[pd.component].set(key, val);
            else perdMap.set(key, val);
          }
        }
      }
    }

    // --- COSTES REGULADOS BOE (Resolución por fecha exacta para cambios de año/BOE a mitad de factura) ---
    const regCosts = await prisma.regulatedCost.findMany({
      where: {
        OR: [{ tariff }, { tariff: 'TODAS' }],
        validFrom: { lte: endDate },
        validTo: { gte: new Date(`${f1StartIsoStr}T00:00:00.000Z`) }
      },
      orderBy: { validFrom: 'asc' }
    });

    type RegSet = {
      perdidasBOE: any;
      fneeCostArray: any;
      peajesEnergiaBOE: any;
      cargosEnergiaBOE: any;
      peajesPotenciaBOE: any;
      cargosPotenciaBOE: any;
      pcBOE: any;
      romBOE: any;
      rosBOE: any;
    };

    const buildRegSet = (records: any[], targetIsoDate?: string): RegSet => {
      const set: RegSet = {
        perdidasBOE: null,
        fneeCostArray: null,
        peajesEnergiaBOE: null,
        cargosEnergiaBOE: null,
        peajesPotenciaBOE: null,
        cargosPotenciaBOE: null,
        pcBOE: null,
        romBOE: null,
        rosBOE: null
      };
      for (const reg of records) {
        if (targetIsoDate) {
          const vf = reg.validFrom.toISOString().substring(0, 10);
          const vt = reg.validTo.toISOString().substring(0, 10);
          if (targetIsoDate < vf || targetIsoDate > vt) continue;
        }
        if (reg.concept === 'PERDIDAS') set.perdidasBOE = reg;
        else if (reg.concept === 'FNEE') set.fneeCostArray = reg;
        else if (reg.concept === 'PEAJES' || reg.concept === 'PEAJES_ENERGIA' || reg.concept === 'Peajes_Energia') set.peajesEnergiaBOE = reg;
        else if (reg.concept === 'CARGOS' || reg.concept === 'CARGOS_ENERGIA' || reg.concept === 'Cargos_Energia') set.cargosEnergiaBOE = reg;
        else if (reg.concept === 'PEAJES_POTENCIA' || reg.concept === 'Peajes_Potencia') set.peajesPotenciaBOE = reg;
        else if (reg.concept === 'CARGOS_POTENCIA' || reg.concept === 'Cargos_Potencia') set.cargosPotenciaBOE = reg;
        else if (reg.concept === 'CAPACIDAD' || reg.concept === 'PC' || reg.concept === 'Pagos_Capacidad') set.pcBOE = reg;
        else if (reg.concept === 'ROM' || reg.concept === 'Pago_OM') set.romBOE = reg;
        else if (reg.concept === 'ROS' || reg.concept === 'Pago_OS') set.rosBOE = reg;
      }
      return set;
    };

    const fallbackRegSet = buildRegSet(regCosts);
    const regSetCache = new Map<string, RegSet>();
    const getRegSetForIsoDate = (isoDate: string): RegSet => {
      let cached = regSetCache.get(isoDate);
      if (!cached) {
        const specific = buildRegSet(regCosts, isoDate);
        cached = {
          perdidasBOE: specific.perdidasBOE || fallbackRegSet.perdidasBOE,
          fneeCostArray: specific.fneeCostArray || fallbackRegSet.fneeCostArray,
          peajesEnergiaBOE: specific.peajesEnergiaBOE || fallbackRegSet.peajesEnergiaBOE,
          cargosEnergiaBOE: specific.cargosEnergiaBOE || fallbackRegSet.cargosEnergiaBOE,
          peajesPotenciaBOE: specific.peajesPotenciaBOE || fallbackRegSet.peajesPotenciaBOE,
          cargosPotenciaBOE: specific.cargosPotenciaBOE || fallbackRegSet.cargosPotenciaBOE,
          pcBOE: specific.pcBOE || fallbackRegSet.pcBOE,
          romBOE: specific.romBOE || fallbackRegSet.romBOE,
          rosBOE: specific.rosBOE || fallbackRegSet.rosBOE
        };
        regSetCache.set(isoDate, cached);
      }
      return cached;
    };

    // --- FINANCIACIÓN DEL BONO SOCIAL (Prorrateo diario exacto por vigencia normativa en cada día del ciclo) ---
    const allBonoSocialRecords = await prisma.regulatedDailyCost.findMany({
      where: { concept: 'Bono_Social' },
      orderBy: { validFrom: 'asc' }
    });

    let bonoSocialUnrounded = 0;
    const bonoLabelsUsed = new Set<string>();
    if (!skipDailyAndPowerCharges) {
      for (let d = 0; d < billingDays; d++) {
        // Sumamos +12h sobre startDate para evitar cualquier salto por cambio de hora DST
        const dayMid = new Date(startDate.getTime() + d * 86400000 + 12 * 3600000);
        const dayIso = dayMid.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
        let matchedRecord: any = null;
        for (const rec of allBonoSocialRecords) {
          const vf = rec.validFrom.toISOString().substring(0, 10);
          const vt = rec.validTo ? rec.validTo.toISOString().substring(0, 10) : null;
          if (dayIso >= vf && (!vt || dayIso <= vt)) {
            matchedRecord = rec;
          }
        }
        if (!matchedRecord && allBonoSocialRecords.length > 0) {
          matchedRecord = allBonoSocialRecords[allBonoSocialRecords.length - 1];
        }
        const rate = matchedRecord ? matchedRecord.amount : 0.01912122;
        bonoSocialUnrounded += rate;
        if (matchedRecord?.label) bonoLabelsUsed.add(matchedRecord.label);
      }
    }
    const bonoSocial = skipDailyAndPowerCharges ? 0 : round2(bonoSocialUnrounded);
    const bonoSocialDailyRate = !skipDailyAndPowerCharges && billingDays > 0 ? bonoSocialUnrounded / billingDays : 0;
    const bonoSocialLabel = bonoLabelsUsed.size > 0
      ? Array.from(bonoLabelsUsed).join(' / ')
      : 'Financiación del Bono Social (Orden TED/1487/2024)';

    // --- FECHA DE FIRMA Y COSTES REGULADOS HISTÓRICOS DE REFERENCIA (Reglas 176, 179, 195) ---
    let airData: any = null;
    if (contract.airtableData) {
      airData = typeof contract.airtableData === 'string'
        ? JSON.parse(contract.airtableData)
        : contract.airtableData;
    }

    let refDate: Date | null = contract.signatureDate;
    if (!refDate) {
      const parseAnyDate = (val: any): Date | null => {
        if (!val) return null;
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        if (typeof val === 'string' && val.includes('/')) {
          const parts = val.split('/');
          if (parts.length === 3) {
            const d2 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            if (!isNaN(d2.getTime())) return d2;
          }
        }
        return null;
      };
      const searchDateKeys = ['FECHA FIRMA', 'Fecha firma', 'fechafirma', 'fechafirmacontrato', 'Fecha de firma de contrato', 'FECHA'];
      for (const k of searchDateKeys) {
        refDate = parseAnyDate(airData?.[k]) || parseAnyDate((contract as any).jsonData?.[k]) || parseAnyDate((supplyPoint as any).airtableData?.[k]);
        if (refDate) break;
      }
      if (!refDate) {
        refDate = contract.activationDate || f1.fechaEmision || new Date();
      }
    }

    const refIsoDate = refDate.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
    const refRegCosts = await prisma.regulatedCost.findMany({
      where: {
        OR: [{ tariff }, { tariff: 'TODAS' }],
        validFrom: { lte: new Date(`${refIsoDate}T23:59:59.999Z`) },
        validTo: { gte: new Date(`${refIsoDate}T00:00:00.000Z`) }
      },
      orderBy: { validFrom: 'asc' }
    });
    const refRegSet = buildRegSet(refRegCosts);

    const getRegVal = (reg: any, p: string): number => {
      if (!reg) return 0;
      if (reg.singleValue !== null && reg.singleValue !== undefined) return reg.singleValue;
      return (reg as any)[p.toLowerCase()] || 0;
    };

    const getAirVal = (key: string): number => {
      if (!airData) return 0;
      const raw = airData[key] ?? airData[`${key} (from PRODUCTOS)`] ?? airData[`PRECIO ${key}`];
      const v = Array.isArray(raw) ? raw[0] : raw;
      return Number(v) || 0;
    };

    // --- DETECCIÓN DE MODALIDAD FIJO vs INDEXADO (Reglas 12, 44, 206) ---
    const prodType = (contract.product?.type || '').toLowerCase();
    const prodName = (contract.product?.name || '').toUpperCase();
    const pm = (contract.pricingModel || '').toUpperCase();
    let isFixed = false;

    if (pm === 'FIJO' || pm === 'FIXED') {
      isFixed = true;
    } else if (pm === 'INDEXADO' || pm === 'INDEX' || pm === 'INDEXED') {
      isFixed = false;
    } else if (prodType.includes('index') || prodType.includes('pass-through') || prodName.includes('INDEX')) {
      isFixed = false;
    } else if (prodType.includes('fijo')) {
      isFixed = true;
    } else {
      const airFijo = airData && typeof airData['FIJO / INDEX'] === 'string' ? airData['FIJO / INDEX'].toUpperCase() : '';
      isFixed = airFijo === 'F' || airFijo === 'FIJO';
    }

    const addIssue = (msg: string, critical: boolean = false) => {
      hasMismatch = true;
      if (critical) hasCriticalError = true;
      originalMismatchReason = originalMismatchReason ? `${originalMismatchReason} | ${msg}` : msg;
    };

    if (isFixed && (!refRegSet.peajesEnergiaBOE || !refRegSet.cargosEnergiaBOE)) {
      addIssue(`Faltan peajes históricos para la fecha de firma o referencia (${refIsoDate}). Actualice la base de datos de Costes Regulados.`, true);
    }

    let feeValue = contract.fee;
    if (feeValue === null || feeValue === undefined) {
      const airFee = getAirVal('FEE_P') || getAirVal('FEE Index Personalizado') || getAirVal('FEE');
      feeValue = airFee || null;
    }
    if (!isFixed && (feeValue === undefined || feeValue === null)) {
      addIssue("Contrato Indexado sin Margen de Comercialización (FEE) configurado.", true);
      feeValue = 0;
    }
    const safeFeeValue = feeValue ?? 0;

    if (!isFixed && (contract.deviationCost === null || contract.deviationCost === undefined)) {
      addIssue("Contrato Indexado sin coste de desvíos (DSV) configurado.", false);
    }

    const periodsBreakdown: Record<string, BillingPeriodBreakdown> = {
      P1: { period: 'P1', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P1'] || 0, energyCostEur: 0, regulatedCostEur: 0 },
      P2: { period: 'P2', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P2'] || 0, energyCostEur: 0, regulatedCostEur: 0 },
      P3: { period: 'P3', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P3'] || 0, energyCostEur: 0, regulatedCostEur: 0 },
      P4: { period: 'P4', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P4'] || 0, energyCostEur: 0, regulatedCostEur: 0 },
      P5: { period: 'P5', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P5'] || 0, energyCostEur: 0, regulatedCostEur: 0 },
      P6: { period: 'P6', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P6'] || 0, energyCostEur: 0, regulatedCostEur: 0 }
    };

    const periodsPeajeEur: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    const periodsCargoEur: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };

    // --- BUCLE CUARTOHORARIO DE ENERGÍA Y COSTE SOMBRA ---
    let totalShadowIndexedCost = 0;
    let totalEnergyCost = 0;
    let totalPeajesEnergiaBOE = 0;
    let totalCargosEnergiaBOE = 0;
    let totalFneeCostEur = 0;

    const hourlyDetails: any[] = [];

    for (const hData of cchHourlyMWh) {
      const localStr = hData.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
      const localDateKey = localStr.substring(0, 10);
      const localHour = parseInt(localStr.substring(11, 13), 10);
      const localMinute = parseInt(localStr.substring(14, 16), 10);
      const key = `${localDateKey}_${localHour}_${localMinute}`;

      const mwh = hData.mwh;
      const p = hData.period;
      if (!periodsBreakdown[p]) continue;

      periodsBreakdown[p].cchConsumptionMWh += mwh;

      const hourRegSet = getRegSetForIsoDate(localDateKey);
      const omie = omieMap.get(key) ?? 0;

      let sumComps = 0;
      const compVals: Record<string, number> = {};
      for (const c of individualComps) {
        const v = compMaps[c].get(key) ?? 0;
        compVals[c] = v;
        sumComps += v;
      }

      const pc = getRegVal(hourRegSet.pcBOE, p) * 1000;
      const rom = getRegVal(hourRegSet.romBOE, p) * 1000;
      const ros = getRegVal(hourRegSet.rosBOE, p) * 1000;
      const fneeCost = getRegVal(hourRegSet.fneeCostArray, p) * 1000;

      const atrPeaje = getRegVal(hourRegSet.peajesEnergiaBOE, p) * 1000;
      const atrCargo = getRegVal(hourRegSet.cargosEnergiaBOE, p) * 1000;
      const atr = atrPeaje + atrCargo;

      if (!isFixed) {
        totalPeajesEnergiaBOE += atrPeaje * mwh;
        totalCargosEnergiaBOE += atrCargo * mwh;
        periodsPeajeEur[p] += atrPeaje * mwh;
        periodsCargoEur[p] += atrCargo * mwh;
        periodsBreakdown[p].regulatedCostEur += atr * mwh;
      }

      let pctPerd = 0;
      if (hourRegSet.perdidasBOE) {
        let pVal = getRegVal(hourRegSet.perdidasBOE, p);
        if (pVal > 0.5) pVal /= 100.0;
        const k = kMap.get(key) || 1;
        pctPerd = pVal * k;
      } else {
        pctPerd = perdMap.get(key) ?? 0;
        if (Math.abs(pctPerd) > 0.5) pctPerd /= 100.0;
      }
      const lossFactor = 1 + pctPerd;

      // Coste mayorista sombra (Regla 176): DSV contractual o 2 €/MWh de referencia, FEE = 0
      const shadowDsv = contract.deviationCost ?? 2;
      const shadowBase = (omie + sumComps + pc + rom + ros + shadowDsv) * lossFactor;
      const shadowPh = (shadowBase + fneeCost) * (1 / 0.985);
      totalShadowIndexedCost += shadowPh * mwh;
      totalFneeCostEur += fneeCost * mwh;

      let ph = 0;
      let hCost = 0;

      if (isFixed) {
        const pNum = parseInt(p.replace('P', ''), 10) || 1;
        let fixedPrice = (contract as any)[`p${pNum}e`];
        if (fixedPrice !== null && fixedPrice !== undefined && fixedPrice < 5) fixedPrice *= 1000;
        if (!fixedPrice) fixedPrice = (getAirVal(`P${pNum}E`) || getAirVal(`P${pNum} E`)) * 1000;
        if (!fixedPrice) fixedPrice = 0;

        const refAtr = (getRegVal(refRegSet.peajesEnergiaBOE, p) + getRegVal(refRegSet.cargosEnergiaBOE, p)) * 1000;
        let refPerdBoe = refRegSet.perdidasBOE ? getRegVal(refRegSet.perdidasBOE, p) : 0;
        if (refPerdBoe > 0.5) refPerdBoe /= 100.0;
        let curPerdBoe = hourRegSet.perdidasBOE ? getRegVal(hourRegSet.perdidasBOE, p) : refPerdBoe;
        if (curPerdBoe > 0.5) curPerdBoe /= 100.0;

        const refSys =
          (getRegVal(refRegSet.pcBOE, p) + getRegVal(refRegSet.romBOE, p) + getRegVal(refRegSet.rosBOE, p)) *
          1000 *
          (1 + refPerdBoe);
        const curSys = (pc + rom + ros) * (1 + curPerdBoe);
        const diffFnee = fneeCost - getRegVal(refRegSet.fneeCostArray, p) * 1000;
        const passThroughReg179 = ((curSys - refSys) + diffFnee) / 0.985;

        ph = fixedPrice - refAtr + passThroughReg179;
        hCost = ph * mwh;
      } else {
        const dsv = contract.deviationCost || 0;
        const base = (omie + sumComps + pc + rom + ros + dsv) * lossFactor;
        ph = (base + fneeCost + safeFeeValue) * (1 / 0.985);
        hCost = ph * mwh;
        totalEnergyCost += hCost;
        periodsBreakdown[p].energyCostEur += hCost;
      }

      if (returnHourlyDetails) {
        hourlyDetails.push({
          date: hData.date.toISOString(),
          period: p,
          mwh,
          omie,
          sumComps,
          compVals,
          dsv: contract.deviationCost || 0,
          pc,
          rom,
          ros,
          k: kMap.get(key) || 1,
          perdBase: hourRegSet.perdidasBOE ? getRegVal(hourRegSet.perdidasBOE, p) : 0,
          pctPerd,
          lossFactor,
          atr,
          fnee: fneeCost,
          fee: safeFeeValue,
          ph,
          hCost
        });
      }
    }

    // --- ENERGÍA PARA CONTRATOS DE PRECIO FIJO (Por bloques F1 y con cuadre céntimo a céntimo) ---
    const energyAtrDetails: any[] = [];
    const energyMarketDetails: any[] = [];

    if (isFixed) {
      totalEnergyCost = 0;
      totalPeajesEnergiaBOE = 0;
      totalCargosEnergiaBOE = 0;

      const blocksToBill = f1SubBlocksActiva.length > 0
        ? f1SubBlocksActiva
        : [{ fechaDesde: f1StartIsoStr, fechaHasta: f1EndIsoStr, startIso: f1StartIsoStr, endExclusiveIso: f1EndIsoStr, volumesMWh: f1VolumesByPeriod }];

      for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
        const b = periodsBreakdown[p];
        if (!b || b.f1ConsumptionMWh <= 0) {
          if (b) {
            b.energyCostEur = 0;
            b.regulatedCostEur = 0;
          }
          continue;
        }

        const pNum = parseInt(p.replace('P', ''), 10) || 1;
        let fixedPrice = (contract as any)[`p${pNum}e`];
        if (fixedPrice !== null && fixedPrice !== undefined && fixedPrice < 5) fixedPrice *= 1000;
        if (!fixedPrice) fixedPrice = (getAirVal(`P${pNum}E`) || getAirVal(`P${pNum} E`)) * 1000;
        if (!fixedPrice) {
          addIssue(`Contrato Fijo sin precio configurado para energía (${p}E).`, true);
          fixedPrice = 0;
        }

        const refAtr = (getRegVal(refRegSet.peajesEnergiaBOE, p) + getRegVal(refRegSet.cargosEnergiaBOE, p)) * 1000;
        const refFnee = getRegVal(refRegSet.fneeCostArray, p) * 1000;
        const refPc = getRegVal(refRegSet.pcBOE, p) * 1000;
        const refRom = getRegVal(refRegSet.romBOE, p) * 1000;
        const refRos = getRegVal(refRegSet.rosBOE, p) * 1000;
        let refPerdBoe = refRegSet.perdidasBOE ? getRegVal(refRegSet.perdidasBOE, p) : 0;
        if (refPerdBoe > 0.5) refPerdBoe /= 100.0;
        const refSys = (refPc + refRom + refRos) * (1 + refPerdBoe);

        let pPeajeUnrounded = 0;
        let pCargoUnrounded = 0;
        let pMarketUnrounded = 0;
        let pTotalBilledUnrounded = 0;

        for (const blk of blocksToBill) {
          const blkMwh = blk.volumesMWh[p] || 0;
          if (blkMwh <= 0) continue;
          // Usamos blk.startIso (FechaDesde + 1 día según Regla 170) para que bloques CNMC como
          // FechaDesde="2025-12-31" -> FechaHasta="2026-05-07" evalúen el BOE de 2026-01-01 y no 2025.
          const blkIso = blk.startIso
            || ((blk.fechaDesde && blk.fechaDesde.length >= 10) ? blk.fechaDesde.substring(0, 10) : f1StartIsoStr);
          const blkReg = getRegSetForIsoDate(blkIso);

          const curPeaje = getRegVal(blkReg.peajesEnergiaBOE, p) * 1000;
          const curCargo = getRegVal(blkReg.cargosEnergiaBOE, p) * 1000;
          const curAtr = curPeaje + curCargo;

          let curPerdBoe = blkReg.perdidasBOE ? getRegVal(blkReg.perdidasBOE, p) : refPerdBoe;
          if (curPerdBoe > 0.5) curPerdBoe /= 100.0;
          const curPc = getRegVal(blkReg.pcBOE, p) * 1000;
          const curRom = getRegVal(blkReg.romBOE, p) * 1000;
          const curRos = getRegVal(blkReg.rosBOE, p) * 1000;
          const curSys = (curPc + curRom + curRos) * (1 + curPerdBoe);
          const diffFnee = getRegVal(blkReg.fneeCostArray, p) * 1000 - refFnee;
          const passThroughReg179 = ((curSys - refSys) + diffFnee) / 0.985;

          const marginPh = fixedPrice - refAtr + passThroughReg179;
          const totalUnitEurMwh = marginPh + curAtr;

          pPeajeUnrounded += curPeaje * blkMwh;
          pCargoUnrounded += curCargo * blkMwh;
          pMarketUnrounded += marginPh * blkMwh;
          pTotalBilledUnrounded += totalUnitEurMwh * blkMwh;
        }

        const kwh = b.f1ConsumptionMWh * 1000;
        const totalPeriodRounded = round2(pTotalBilledUnrounded);
        const atrTotalRounded = round2(pPeajeUnrounded + pCargoUnrounded);
        const atrPeajeRounded = round2(pPeajeUnrounded);
        const atrCargoRounded = round2(atrTotalRounded - atrPeajeRounded);
        // Garantiza que round2(ATR) + round2(Mercado) === round2(TotalPeriodo) y Peaje + Cargo === ATR sin descuadres de 0.01 €
        const marketTotalRounded = round2(totalPeriodRounded - atrTotalRounded);

        b.energyCostEur = marketTotalRounded;
        b.regulatedCostEur = atrTotalRounded;

        totalEnergyCost = round2(totalEnergyCost + marketTotalRounded);
        totalPeajesEnergiaBOE = round2(totalPeajesEnergiaBOE + atrPeajeRounded);
        totalCargosEnergiaBOE = round2(totalCargosEnergiaBOE + atrCargoRounded);

        energyAtrDetails.push({
          period: p,
          kwh,
          price: kwh > 0 ? (pPeajeUnrounded + pCargoUnrounded) / kwh : 0,
          total: atrTotalRounded,
          peajeEur: atrPeajeRounded,
          cargoEur: atrCargoRounded
        });

        energyMarketDetails.push({
          period: p,
          kwh,
          price: kwh > 0 ? pMarketUnrounded / kwh : 0,
          total: marketTotalRounded,
          refAtr,
          currentAtr: b.f1ConsumptionMWh > 0 ? (pPeajeUnrounded + pCargoUnrounded) / b.f1ConsumptionMWh : 0
        });
      }
    } else {
      // INDEXADO: líneas por periodo redondeadas a 2 decimales comerciales
      totalEnergyCost = 0;
      totalPeajesEnergiaBOE = 0;
      totalCargosEnergiaBOE = 0;

      for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
        const b = periodsBreakdown[p];
        const mwh = b?.cchConsumptionMWh || b?.f1ConsumptionMWh || 0;
        if (!b || mwh <= 0) continue;

        const kwh = mwh * 1000;
        const rawMarket = b.energyCostEur;
        const rawPeaje = periodsPeajeEur[p] || 0;
        const rawCargo = periodsCargoEur[p] || 0;
        const rawAtr = rawPeaje + rawCargo;

        const atrTotalRounded = round2(rawAtr);
        const marketTotalRounded = round2(rawMarket);
        const peajeRounded = round2(rawPeaje);
        const cargoRounded = round2(atrTotalRounded - peajeRounded);

        b.energyCostEur = marketTotalRounded;
        b.regulatedCostEur = atrTotalRounded;

        totalEnergyCost = round2(totalEnergyCost + marketTotalRounded);
        totalPeajesEnergiaBOE = round2(totalPeajesEnergiaBOE + peajeRounded);
        totalCargosEnergiaBOE = round2(totalCargosEnergiaBOE + cargoRounded);

        energyAtrDetails.push({
          period: p,
          kwh,
          price: kwh > 0 ? rawAtr / kwh : 0,
          total: atrTotalRounded,
          peajeEur: peajeRounded,
          cargoEur: cargoRounded
        });

        energyMarketDetails.push({
          period: p,
          kwh,
          price: kwh > 0 ? rawMarket / kwh : 0,
          total: marketTotalRounded,
          refAtr: 0,
          currentAtr: mwh > 0 ? rawAtr / mwh : 0
        });
      }
    }

    // --- TÉRMINO DE POTENCIA (Día a día según BOE vigente y normalizado a €/kW/día) ---
    const p1c = contract.p1c ?? supplyPoint.p1c ?? getAirVal('P1C') ?? 0;
    const p2c = contract.p2c ?? supplyPoint.p2c ?? getAirVal('P2C') ?? 0;
    const p3c = contract.p3c ?? supplyPoint.p3c ?? getAirVal('P3C') ?? 0;
    const p4c = contract.p4c ?? supplyPoint.p4c ?? getAirVal('P4C') ?? 0;
    const p5c = contract.p5c ?? supplyPoint.p5c ?? getAirVal('P5C') ?? 0;
    const p6c = contract.p6c ?? supplyPoint.p6c ?? getAirVal('P6C') ?? 0;

    const sumBilledPower = (p1c || 0) + (p2c || 0) + (p3c || 0) + (p4c || 0) + (p5c || 0) + (p6c || 0);
    const sumF1ContractedPower = Object.values(f1PotenciaContratadaMax).reduce((acc, v) => acc + v, 0);

    const powerDetails: any[] = [];
    let powerCost = 0;
    let boePowerCost = 0;

    if (!skipDailyAndPowerCharges) {
      if (sumF1ContractedPower > 0 && Math.abs(sumF1ContractedPower - sumBilledPower) > 0.1) {
        addIssue(
          `Descuadre de potencia: El F1 indica una suma de potencias contratadas de ${sumF1ContractedPower.toFixed(3)} kW, pero el contrato del ERP suma ${sumBilledPower.toFixed(3)} kW.`,
          false
        );
      }

      const baseP1p = contract.p1p || getAirVal('P1P') || getAirVal('P1 P');
      if (!baseP1p) {
        throw new Error("Contrato sin precio de Término de Potencia (P1P) configurado.");
      }

      const p1p = baseP1p;
      const p2p = contract.p2p || getAirVal('P2P') || getAirVal('P2 P') || p1p;
      const p3p = contract.p3p || getAirVal('P3P') || getAirVal('P3 P') || p1p;
      const p4p = contract.p4p || getAirVal('P4P') || getAirVal('P4 P') || p1p;
      const p5p = contract.p5p || getAirVal('P5P') || getAirVal('P5 P') || p1p;
      const p6p = contract.p6p || getAirVal('P6P') || getAirVal('P6 P') || p1p;

      const isYearlyPower = p1p > 2; // > 2 € indica €/kW/año; <= 2 € indica €/kW/día

      const processPower = (period: string, kw: number, contractPrice: number) => {
        if (!kw || !contractPrice) return;

        const refAtrPeajeYearly = getRegVal(refRegSet.peajesPotenciaBOE, period);
        const refAtrCargoYearly = getRegVal(refRegSet.cargosPotenciaBOE, period);
        const refAtrYearly = refAtrPeajeYearly + refAtrCargoYearly;

        let sumBilledUnrounded = 0;
        let sumPeajeUnrounded = 0;
        let sumCargoUnrounded = 0;
        let sumBoeUnrounded = 0;

        for (let d = 0; d < billingDays; d++) {
          const dayMid = new Date(startDate.getTime() + d * 86400000 + 12 * 3600000);
          const dayIso = dayMid.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
          const yr = parseInt(dayIso.substring(0, 4), 10);
          const daysInYr = isLeapYear(yr) ? 366.0 : 365.0;

          const dayReg = getRegSetForIsoDate(dayIso);
          const curPeajeYearly = getRegVal(dayReg.peajesPotenciaBOE, period);
          const curCargoYearly = getRegVal(dayReg.cargosPotenciaBOE, period);
          const curAtrYearly = curPeajeYearly + curCargoYearly;

          const dailyPeaje = curPeajeYearly / daysInYr;
          const dailyCargo = curCargoYearly / daysInYr;
          const dailyCurAtr = curAtrYearly / daysInYr;

          let dailyBilledPrice: number;
          if (isYearlyPower) {
            const yearlyMargin = contractPrice - refAtrYearly;
            const yearlyBilled = yearlyMargin + curAtrYearly;
            dailyBilledPrice = yearlyBilled / daysInYr;
          } else {
            const refDailyAtr = refAtrYearly / 365.0;
            const dailyMargin = contractPrice - refDailyAtr;
            dailyBilledPrice = dailyMargin + dailyCurAtr;
          }

          sumBilledUnrounded += kw * dailyBilledPrice;
          sumPeajeUnrounded += kw * dailyPeaje;
          sumCargoUnrounded += kw * dailyCargo;
          sumBoeUnrounded += kw * dailyCurAtr;
        }

        const billedRounded = round2(sumBilledUnrounded);
        const peajeRounded = round2(sumPeajeUnrounded);
        const cargoRounded = round2(sumCargoUnrounded);
        const effectiveDailyPrice = billingDays > 0 && kw > 0 ? sumBilledUnrounded / (kw * billingDays) : 0;

        powerCost = round2(powerCost + billedRounded);
        boePowerCost = round2(boePowerCost + round2(sumBoeUnrounded));

        powerDetails.push({
          period,
          kw,
          days: billingDays,
          price: effectiveDailyPrice, // Siempre normalizado en €/kW/día según AGENTS.md
          yearlyPrice: isYearlyPower ? contractPrice : effectiveDailyPrice * 365,
          total: billedRounded,
          peajeEur: peajeRounded,
          cargoEur: cargoRounded
        });
      };

      processPower('P1', p1c, p1p);
      processPower('P2', p2c, p2p);
      processPower('P3', p3c, p3p);
      processPower('P4', p4c, p4p);
      processPower('P5', p5c, p5p);
      processPower('P6', p6c, p6p);
    }

    // Repercusión de Penalización por ausencia de ICP o Recargo por duración inferior al año si la distribuidora lo cobra en el F1
    let penalizacionNoIcpCost = 0;
    let recargoInfAnioCost = 0;
    const penalizacionFlag = jsonData?.Potencia?.PenalizacionNoICP;
    const f1TotalPeajesPotencia = Math.abs(parseXmlNum(jsonData?.Potencia?.ImporteTotalTerminoPotencia));
    const ourSumPeajesPotencia = round2(powerDetails.reduce((acc, pd) => acc + pd.peajeEur, 0));

    if (penalizacionFlag === 'S' && f1TotalPeajesPotencia > ourSumPeajesPotencia + 0.05) {
      // La distribuidora ha facturado potencia penalizada (ej. 20 kW por ausencia de ICP); repercutimos el sobrecoste ATR
      const f1CargosPotencia = getArray(jsonData?.Cargos?.Cargo)
        .filter((cg: any) => String(cg?.TipoCargo || '') === '01')
        .reduce((acc: number, cg: any) => acc + Math.abs(parseXmlNum(cg?.TotalImporteTipoCargo)), 0);
      const ourSumCargosPotencia = round2(powerDetails.reduce((acc, pd) => acc + pd.cargoEur, 0));
      const extraPeaje = Math.max(0, f1TotalPeajesPotencia - ourSumPeajesPotencia);
      const extraCargo = f1CargosPotencia > ourSumCargosPotencia ? (f1CargosPotencia - ourSumCargosPotencia) : 0;
      penalizacionNoIcpCost = round2(extraPeaje + extraCargo);
      if (penalizacionNoIcpCost > 0) {
        addIssue(`Penalización distribuidora por ausencia de ICP repercutida: ${penalizacionNoIcpCost.toFixed(2)} €.`, false);
      }
    } else if (
      jsonData?.DatosGeneralesFacturaATR?.DatosFacturaATR?.DuracionInfAnio === 'S' &&
      f1TotalPeajesPotencia > ourSumPeajesPotencia + 0.05
    ) {
      recargoInfAnioCost = round2(f1TotalPeajesPotencia - ourSumPeajesPotencia);
      if (recargoInfAnioCost > 0) {
        addIssue(`Recargo distribuidora por contrato de duración inferior al año: ${recargoInfAnioCost.toFixed(2)} €.`, false);
      }
    }

    // --- MÁRGENES COMERCIALES (Calculados DESPUÉS de resolver tanto Fijo como Indexado) ---
    const energyMargin = round2(
      isFixed
        ? totalEnergyCost - totalShadowIndexedCost
        : safeFeeValue * totalCchMWh
    );
    const powerMargin = round2(powerCost - boePowerCost);
    const totalCommercialMargin = round2(energyMargin + powerMargin);

    if (powerMargin < -0.01) {
      addIssue("Margen de potencia negativo. Verifique precios P1P-P6P.", true);
    }

    // --- ALQUILER DE EQUIPO DE MEDIDA ---
    let alquilerEquipo = 0;
    const alqNode = jsonData?.Alquileres || jsonData?.AlquileresFacturados;
    if (alqNode) {
      alquilerEquipo = Math.abs(parseXmlNum(alqNode.ImporteFacturacionAlquileres));
      if (alquilerEquipo === 0 && alqNode.PrecioDiarioAlquiler) {
        const diarios = getArray(alqNode.PrecioDiarioAlquiler);
        for (const pd of diarios) {
          alquilerEquipo += Math.abs(parseXmlNum(pd?.PrecioDia)) * Math.abs(parseXmlNum(pd?.NumeroDias));
        }
      }
    }
    alquilerEquipo = round2(alquilerEquipo);

    // --- EXCESOS DE POTENCIA ---
    let excesosPotencia = 0;
    if (jsonData['Importe Total Excesos ATR']) {
      excesosPotencia = Math.abs(parseXmlNum(jsonData['Importe Total Excesos ATR']));
    } else if (jsonData['Importe Excesos Potencia']) {
      excesosPotencia = Math.abs(parseXmlNum(jsonData['Importe Excesos Potencia']));
    } else if (jsonData['Importe Total Excesos ATR F1']) {
      excesosPotencia = Math.abs(parseXmlNum(jsonData['Importe Total Excesos ATR F1']));
    } else if (jsonData.ExcesoPotencia?.ImporteTotalExcesos) {
      excesosPotencia = Math.abs(parseXmlNum(jsonData.ExcesoPotencia.ImporteTotalExcesos));
    }
    excesosPotencia = round2(excesosPotencia);

    // --- EXCEDENTES DE AUTOCONSUMO ---
    let excedentesAutoconsumo = 0;
    let surplusKwhForOutput = 0;
    let pexc: number | null = contract.pexc !== undefined && contract.pexc !== null ? Number(contract.pexc) : null;
    if ((pexc === null || pexc === 0) && getAirVal('PEXC') > 0) {
      pexc = getAirVal('PEXC');
    }

    if (jsonData['Importe Excedentes Autoconsumo']) {
      excedentesAutoconsumo = Math.abs(parseXmlNum(jsonData['Importe Excedentes Autoconsumo']));
    } else if (jsonData?.Autoconsumo?.EnergiaExcedentaria?.ValorTotalEnergiaExcedentaria !== undefined) {
      const surplusKwh = Math.abs(parseXmlNum(jsonData.Autoconsumo.EnergiaExcedentaria.ValorTotalEnergiaExcedentaria));
      surplusKwhForOutput = surplusKwh;
      const surplusMwh = surplusKwh / 1000.0;

      const feeExcedentes: number | null =
        contract.feeExcedentes !== undefined && contract.feeExcedentes !== null ? Number(contract.feeExcedentes) : null;

      if (surplusMwh > 0) {
        if (pexc !== null && pexc > 0) {
          // Si pexc < 2 asumimos €/kWh, si >= 2 asumimos €/MWh
          const pexcMwh = pexc < 2 ? pexc * 1000 : pexc;
          pexc = pexcMwh;
          excedentesAutoconsumo = surplusMwh * pexcMwh;
        } else if (feeExcedentes !== null) {
          let sumPago = 0;
          const feeExcMwh = Math.abs(feeExcedentes) < 0.5 && feeExcedentes !== 0 ? feeExcedentes * 1000 : feeExcedentes;
          for (const hData of cchSurplusHourlyMWh) {
            const localStr = hData.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
            const key = `${localStr.substring(0, 10)}_${parseInt(localStr.substring(11, 13), 10)}_${parseInt(localStr.substring(14, 16), 10)}`;
            const omie = omieMap.get(key) ?? 0;
            const precio = Math.max(0, omie - feeExcMwh);
            sumPago += hData.mwh * precio;
            if (returnHourlyDetails) {
              const hDetail = hourlyDetails.find(h => h.date === hData.date.toISOString());
              if (hDetail) {
                hDetail.surplusMwh = hData.mwh;
                hDetail.surplusPrice = precio;
                hDetail.surplusPayout = hData.mwh * precio;
              }
            }
          }
          excedentesAutoconsumo = sumPago;
          pexc = surplusMwh > 0 ? sumPago / surplusMwh : 0;
        } else {
          addIssue("Cliente con excedentes pero sin precio PEXC ni feeExcedentes configurado en el contrato (se aplica 0 €).", true);
          pexc = 0;
          excedentesAutoconsumo = 0;
        }
      }
    }
    excedentesAutoconsumo = round2(excedentesAutoconsumo);

    // --- ENERGÍA REACTIVA INDUCTIVA (Circular 3/2020) Y CAPACITIVA (P6) ---
    let reactiveEnergyCost = 0;
    const reactiveDetails: any[] = [];

    let parsedReac = NaN;
    if (jsonData) {
      let totalParsed = 0;
      let hasDetailed = false;

      for (const t of termReactiva) {
        const periodos = getArray(t?.Periodo);
        for (let i = 0; i < periodos.length; i++) {
          const p = periodos[i];
          const pNameRaw = Array.isArray(p.Periodo) ? p.Periodo[0] : (p.Periodo || p.periodo || '');
          let pName = typeof pNameRaw === 'string' ? pNameRaw.trim() : (pNameRaw ? pNameRaw.toString().trim() : '');
          if (!pName && periodos.length >= 3) pName = `P${i + 1}`;
          if (!pName) continue;
          const pFormatted = pName.startsWith('P') ? pName : `P${pName}`;

          let cost = Math.abs(parseXmlNum(p.ImporteTerminoEnergiaReactiva ?? p.importeTerminoEnergiaReactiva ?? p.ImporteTotalEnergiaReactiva));
          const kvarh = Math.abs(parseXmlNum(p.ValorEnergiaReactiva ?? p.valorEnergiaReactiva ?? p.EnergiaReactivaTotal ?? p.energiaReactivaTotal));

          if (cost === 0 && kvarh > 0 && p.PrecioEnergiaReactiva !== undefined) {
            const price = Math.abs(parseXmlNum(p.PrecioEnergiaReactiva));
            if (price > 0) cost = kvarh * price;
          }
          cost = round2(cost);
          if (cost > 0) {
            reactiveDetails.push({ period: pFormatted, cost, kvarh, excessKvarh: 0 });
            totalParsed = round2(totalParsed + cost);
            hasDetailed = true;
          }
        }
      }

      if (hasDetailed) {
        parsedReac = totalParsed;
      } else if (jsonData['Importe Total Energia Reactiva']) {
        parsedReac = Math.abs(parseXmlNum(jsonData['Importe Total Energia Reactiva']));
      } else if (jsonData['ImporteTotalRAtr']) {
        parsedReac = Math.abs(parseXmlNum(jsonData['ImporteTotalRAtr']));
      } else if (jsonData['Importe Total RAtr']) {
        parsedReac = Math.abs(parseXmlNum(jsonData['Importe Total RAtr']));
      } else if (jsonData.EnergiaReactiva) {
        const er = jsonData.EnergiaReactiva;
        const val = Array.isArray(er) ? er[0]?.ImporteTotalEnergiaReactiva : er.ImporteTotalEnergiaReactiva;
        if (val !== undefined) parsedReac = Math.abs(parseXmlNum(val));
      }
    }

    if (!isNaN(parsedReac) && parsedReac > 0) {
      reactiveEnergyCost = round2(parsedReac);
      if (reactiveDetails.length === 0) {
        reactiveDetails.push({ period: 'TOTAL', cost: reactiveEnergyCost, kvarh: 0, excessKvarh: 0 });
      }
    } else {
      // Fallback Circular 3/2020 (Regla 177)
      let fallbackTriggered = false;
      if (tariff && !tariff.includes('2.0TD')) {
        for (const p of ['P1', 'P2', 'P3', 'P4', 'P5']) {
          const actCons = f1Readings[p]?.actCons || 0;
          const reactCons = f1Readings[p]?.reactCons || 0;
          if (actCons > 0 && reactCons > actCons * 0.33) {
            const limit33 = actCons * 0.33;
            const limit75 = actCons * 0.75;
            let cost = 0;
            const excessTier1 = Math.min(reactCons, limit75) - limit33;
            if (excessTier1 > 0) cost += excessTier1 * 0.041554;
            if (reactCons > limit75) cost += (reactCons - limit75) * 0.062332;
            cost = round2(cost);
            if (cost > 0) {
              fallbackTriggered = true;
              reactiveEnergyCost = round2(reactiveEnergyCost + cost);
              reactiveDetails.push({
                period: p,
                kvarh: reactCons,
                excessKvarh: round2(reactCons - limit33),
                cost
              });
            }
          }
        }
      }
      if (fallbackTriggered) {
        addIssue("La distribuidora no ha repercutido penalización por reactiva, pero ha sido facturada al cliente por exceso físico (Fallback Circular 3/2020).", false);
      }
    }

    // Energía Reactiva Capacitiva (P6 - Facturacion.xsd <EnergiaCapacitiva>)
    let capacitiveEnergyCost = Math.abs(parseXmlNum(jsonData?.EnergiaCapacitiva?.ImporteTotalEnergiaCapacitiva));
    capacitiveEnergyCost = round2(capacitiveEnergyCost);
    if (capacitiveEnergyCost > 0) {
      reactiveEnergyCost = round2(reactiveEnergyCost + capacitiveEnergyCost);
      reactiveDetails.push({
        period: 'P6 Cap.',
        kvarh: 0,
        excessKvarh: 0,
        cost: capacitiveEnergyCost
      });
    }

    // --- TOPE DE EXCEDENTES RD 244/2019 Y BOLSILLO SOLAR (Batería Virtual) ---
    const hasBolsilloSolar = Boolean(
      contract.bolsilloSolar === true ||
      (airData && String(airData['BOLSILLO SOLAR'] || '').toUpperCase() === 'SI')
    );

    let maxExcedentes = 0;
    if (energyMarketDetails.length > 0) {
      maxExcedentes = round2(energyMarketDetails.reduce((acc, detail) => acc + detail.total, 0));
    }
    maxExcedentes = round2(maxExcedentes + Math.max(0, powerMargin));

    let bolsilloSolarLlenado = 0;
    if (excedentesAutoconsumo > maxExcedentes) {
      if (hasBolsilloSolar) {
        bolsilloSolarLlenado = round2(excedentesAutoconsumo - maxExcedentes);
      }
      excedentesAutoconsumo = maxExcedentes;
    }

    // Costes de Gestión Bolsillo Solar (Regla 207: SOLO si bolsilloSolar === true)
    let cgBolsilloSolarCost = 0;
    let cgBolsilloSolarDailyRate = 0;
    if (!skipDailyAndPowerCharges && hasBolsilloSolar && contract.cgBolsilloSolar && contract.cgBolsilloSolar > 0) {
      const rawCg = Number(contract.cgBolsilloSolar);
      // Si rawCg > 0.5 se almacena como €/mes (ej. 3.90 €/mes -> * 12 / 365 €/día); si <= 0.5 es €/día
      cgBolsilloSolarDailyRate = rawCg > 0.5 ? (rawCg * 12.0) / 365.0 : rawCg;
      cgBolsilloSolarCost = round2(cgBolsilloSolarDailyRate * billingDays);
    }

    // --- BASE IMPONIBLE SUJETA A IMPUESTO ELÉCTRICO (Base = TPA + TEA + TER - Excedentes compensados) ---
    const baseIEE = round2(
      totalEnergyCost +
      totalPeajesEnergiaBOE +
      totalCargosEnergiaBOE +
      powerCost +
      penalizacionNoIcpCost +
      recargoInfAnioCost +
      excesosPotencia +
      reactiveEnergyCost -
      excedentesAutoconsumo
    );

    // --- IMPUESTO ELÉCTRICO (IEE - Ley 38/1992 Art. 94, 98 y 99) ---
    const ieeRate = (contract as any).taxElectric !== undefined && (contract as any).taxElectric !== null
      ? Number((contract as any).taxElectric)
      : 5.11269632;

    const regFiscal = (supplyPoint.regimenFiscal || '').trim().toUpperCase();
    const isExemptArt94 = regFiscal.startsWith('94.');
    const isReduced100Art98 = regFiscal === '98.2' || regFiscal === '98.3';
    const isReduced85NoMin = ['98.1A', '98.1B', '98.1C', '98.1D'].includes(regFiscal);
    const isReducedArt98 = regFiscal.startsWith('98.1');

    let ieeReductionPct = 0;
    if (isExemptArt94 || isReduced100Art98) {
      ieeReductionPct = 100;
    } else if (supplyPoint.ieDiscount !== null && supplyPoint.ieDiscount !== undefined && supplyPoint.ieDiscount > 0) {
      ieeReductionPct = Math.min(100, Number(supplyPoint.ieDiscount));
    } else if (isReducedArt98) {
      ieeReductionPct = 85;
    }

    let taxElectric = 0;
    if (totalF1MWh > 0 && !isExemptArt94) {
      const minTaxRate =
        isReduced100Art98 || regFiscal === '98.1E' || regFiscal === '98.1F' || regFiscal === 'SBFI'
          ? 0.5
          : tariff.includes('2.0TD') || tariff.includes('3.0TD')
            ? 1.0
            : 0.5;
      const minTaxAmount = totalF1MWh * minTaxRate;

      if (isReduced100Art98 || ieeReductionPct >= 100) {
        // Art. 98.2 y 98.3 LIIEE: reducción del 100% en base, tributando exclusivamente por cuota mínima (Art. 99.2)
        taxElectric = round2(minTaxAmount);
      } else {
        const liquidableBaseIEE = Math.max(0, round2(baseIEE * (1 - ieeReductionPct / 100.0)));
        const quotaPct = liquidableBaseIEE * (ieeRate / 100.0);
        // Art. 98.1.a)-d) LIIEE: reducción del 85% sin cuota mínima; resto (SBFO, SBFI, 98.1e-f): aplica mínimo Art. 99.2
        taxElectric = isReduced85NoMin ? round2(quotaPct) : round2(Math.max(quotaPct, minTaxAmount));
      }
    }

    // --- SERVICIOS DE VALOR AÑADIDO (SVA modernos AdditionalService + Legacy sin duplicidad - Regla 175) ---
    let svaCost = 0;
    let svaConcept = '';
    const svaDetails: SvaDetailItem[] = [];

    const calcServiceOverlapDays = (durationMonths: number | null | undefined): number => {
      const dur = durationMonths || 120;
      const tSva = contract.svaStartDate ? new Date(contract.svaStartDate).getTime() : 0;
      const tAct = contract.activationDate ? new Date(contract.activationDate).getTime() : 0;
      const tSig = contract.signatureDate ? new Date(contract.signatureDate).getTime() : 0;

      let baseStart = tSva > 0 ? tSva : (tAct > 0 ? tAct : tSig);
      if (tSva > 0 && tAct > 0) baseStart = Math.max(tSva, tAct);

      if (baseStart <= 0) return billingDays;

      const startIso = new Date(baseStart).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
      const actualSvaStart = fromZonedTime(`${startIso}T00:00:00`, 'Europe/Madrid');
      const endObj = new Date(actualSvaStart);
      endObj.setMonth(endObj.getMonth() + dur);

      const overlapStartMs = Math.max(startDate.getTime(), actualSvaStart.getTime());
      const overlapEndMs = Math.min(endDate.getTime(), endObj.getTime());
      if (overlapEndMs <= overlapStartMs) return 0;
      return Math.round((overlapEndMs - overlapStartMs) / (1000 * 3600 * 24));
    };

    const snapshotServices = Array.isArray(contract.additionalServicesSnapshot)
      ? (contract.additionalServicesSnapshot as any[])
      : [];
    const relationServices = Array.isArray((contract as any).AdditionalService)
      ? ((contract as any).AdditionalService as any[])
      : [];

    // Unificar snapshot + relación por ID/nombre para no perder servicios migrados parcialmente sin duplicar ninguno
    const mergedServicesMap = new Map<string, any>();
    for (const relSrv of relationServices) {
      const key = relSrv.id || relSrv.name;
      if (key) mergedServicesMap.set(key, { ...relSrv });
    }
    for (const snapSrv of snapshotServices) {
      const key = snapSrv.id || snapSrv.name;
      if (key) {
        const existing = mergedServicesMap.get(key) || {};
        mergedServicesMap.set(key, { ...existing, ...snapSrv });
      }
    }
    const modernServices = Array.from(mergedServicesMap.values());

    if (!skipDailyAndPowerCharges && modernServices.length > 0) {
      let unroundedSumSva = 0;
      for (const srv of modernServices) {
        const ovDays = calcServiceOverlapDays(srv.durationMonths);
        if (ovDays <= 0) continue;
        let dailyRate = 0;
        if (srv.dailyPrice !== null && srv.dailyPrice !== undefined && Number(srv.dailyPrice) > 0) {
          dailyRate = Number(srv.dailyPrice);
        } else if (srv.monthlyPrice !== null && srv.monthlyPrice !== undefined && Number(srv.monthlyPrice) > 0) {
          dailyRate = (Number(srv.monthlyPrice) * 12.0) / 365.0;
        }
        const lineUnrounded = dailyRate * ovDays;
        const lineTotal = round2(lineUnrounded);
        if (lineTotal > 0) {
          svaDetails.push({
            name: srv.name || 'Servicio Adicional',
            days: ovDays,
            dailyPrice: dailyRate,
            total: lineTotal
          });
          unroundedSumSva += lineUnrounded;
        }
      }
      svaCost = round2(unroundedSumSva);
      // Ajustar último elemento por 0.01 € si la suma de redondeados difiere del total agrupado SVA
      const sumLines = round2(svaDetails.reduce((a, b) => a + b.total, 0));
      if (svaDetails.length > 0 && sumLines !== svaCost) {
        svaDetails[svaDetails.length - 1].total = round2(svaDetails[svaDetails.length - 1].total + (svaCost - sumLines));
      }
      svaConcept = contract.svaConcept || svaDetails.map(s => s.name).join(' + ');
    } else if (!skipDailyAndPowerCharges && contract.svaPrice && contract.svaDuration) {
      const ovDays = calcServiceOverlapDays(contract.svaDuration);
      if (ovDays > 0) {
        const svaMonthlyPrice = contract.svaPrice / contract.svaDuration;
        const svaDailyPrice = (svaMonthlyPrice * 12.0) / 365.0;
        svaCost = round2(svaDailyPrice * ovDays);
        svaConcept = contract.svaConcept || 'Servicio Adicional (SVA)';
        if (svaCost > 0) {
          svaDetails.push({
            name: svaConcept,
            days: ovDays,
            dailyPrice: svaDailyPrice,
            total: svaCost
          });
        }
      }
    }

    // --- BASE IMPONIBLE E IMPUESTOS INDIRECTOS (IVA Península / IGIC Canarias / IPSI Ceuta-Melilla) ---
    const energyAndPowerAndIeeBase = round2(baseIEE + taxElectric + bonoSocial);
    const servicesAndRentalBase = round2(alquilerEquipo + svaCost + cgBolsilloSolarCost + conceptosRepercutiblesBase);
    const totalBase = round2(energyAndPowerAndIeeBase + servicesAndRentalBase);

    let taxType: 'IVA' | 'IGIC' | 'IPSI' = 'IVA';
    let taxPercentage = 21;
    let taxAmount = 0;
    const taxBreakdown: TaxBreakdownItem[] = [];

    if (isCanarias) {
      taxType = 'IGIC';
      const maxContractPower = Math.max(p1c || 0, p2c || 0, p3c || 0, p4c || 0, p5c || 0, p6c || 0);
      const isZeroIgicSupply = isPhysicalPerson && tariff.includes('2.0TD') && maxContractPower <= 10.0;
      const energyIgicRate = isZeroIgicSupply ? 0 : 3;
      const servicesIgicRate = 7;

      const energyTaxAmt = round2(energyAndPowerAndIeeBase * (energyIgicRate / 100.0));
      taxBreakdown.push({
        taxType: 'IGIC',
        rate: energyIgicRate,
        base: energyAndPowerAndIeeBase,
        amount: energyTaxAmt,
        label: `${energyIgicRate}% IGIC Electricidad (BI ${energyAndPowerAndIeeBase.toFixed(2)} €)`
      });

      let servicesTaxAmt = 0;
      if (servicesAndRentalBase !== 0) {
        // En Canarias el alquiler de contador doméstico <=10kW tributa al 3% o 7% según distribuidora; servicios al 7%
        const f1RentalIgicPct = parseXmlNum(getArray(jsonData?.IVA)?.[0]?.Porcentaje) || servicesIgicRate;
        const rentalTaxAmt = round2(alquilerEquipo * (f1RentalIgicPct / 100.0));
        const otherSrvBase = round2(servicesAndRentalBase - alquilerEquipo);
        const otherSrvTaxAmt = round2(otherSrvBase * (servicesIgicRate / 100.0));
        servicesTaxAmt = round2(rentalTaxAmt + otherSrvTaxAmt);

        if (alquilerEquipo !== 0 && f1RentalIgicPct !== servicesIgicRate) {
          taxBreakdown.push({
            taxType: 'IGIC',
            rate: f1RentalIgicPct,
            base: alquilerEquipo,
            amount: rentalTaxAmt,
            label: `${f1RentalIgicPct}% IGIC Alquiler (BI ${alquilerEquipo.toFixed(2)} €)`
          });
          if (otherSrvBase !== 0) {
            taxBreakdown.push({
              taxType: 'IGIC',
              rate: servicesIgicRate,
              base: otherSrvBase,
              amount: otherSrvTaxAmt,
              label: `${servicesIgicRate}% IGIC Servicios (BI ${otherSrvBase.toFixed(2)} €)`
            });
          }
        } else {
          taxBreakdown.push({
            taxType: 'IGIC',
            rate: servicesIgicRate,
            base: servicesAndRentalBase,
            amount: servicesTaxAmt,
            label: `${servicesIgicRate}% IGIC Servicios/Alquiler (BI ${servicesAndRentalBase.toFixed(2)} €)`
          });
        }
      }

      taxAmount = round2(energyTaxAmt + servicesTaxAmt);
      taxPercentage = energyIgicRate;
    } else if (isCeutaMelilla) {
      taxType = 'IPSI';
      const energyIpsiRate = 1;
      const servicesIpsiRate = 4;
      const energyTaxAmt = round2(energyAndPowerAndIeeBase * (energyIpsiRate / 100.0));
      const srvTaxAmt = round2(servicesAndRentalBase * (servicesIpsiRate / 100.0));
      taxBreakdown.push({
        taxType: 'IPSI',
        rate: energyIpsiRate,
        base: energyAndPowerAndIeeBase,
        amount: energyTaxAmt,
        label: `${energyIpsiRate}% IPSI Electricidad (BI ${energyAndPowerAndIeeBase.toFixed(2)} €)`
      });
      if (servicesAndRentalBase !== 0) {
        taxBreakdown.push({
          taxType: 'IPSI',
          rate: servicesIpsiRate,
          base: servicesAndRentalBase,
          amount: srvTaxAmt,
          label: `${servicesIpsiRate}% IPSI Servicios/Alquiler (BI ${servicesAndRentalBase.toFixed(2)} €)`
        });
      }
      taxAmount = round2(energyTaxAmt + srvTaxAmt);
      taxPercentage = energyIpsiRate;
    } else {
      taxType = 'IVA';
      taxPercentage = 21;
      taxAmount = round2(totalBase * 0.21);
      taxBreakdown.push({
        taxType: 'IVA',
        rate: 21,
        base: totalBase,
        amount: taxAmount,
        label: `21% IVA (BI ${totalBase.toFixed(2)} €)`
      });
    }

    const totalSinDescuentoBolsillo = round2(totalBase + taxAmount + conceptosRepercutiblesExempt);

    // --- SALDO HISTÓRICO, USO Y SALDO FINAL DE BOLSILLO SOLAR (Consulta Vinculante V0588-21: descuento post-IVA) ---
    let bolsilloSolarSaldoInicial = 0;
    let bolsilloSolarUso = 0;
    let bolsilloSolarSaldoFinal = 0;

    if (hasBolsilloSolar && !isAbono) {
      // Buscar el último saldo final confirmado en InternalInvoice (o fallback a Invoice histórico de Airtable/Odoo)
      const prevInternal = await prisma.internalInvoice.findFirst({
        where: {
          supplyPointId: supplyPoint.id,
          status: { in: ['EMITIDA', 'ABONO'] },
          f1InvoiceId: { not: f1.id },
          ...(f1.fechaInicio ? { billingEnd: { lte: f1.fechaInicio } } : {})
        },
        orderBy: { billingEnd: 'desc' }
      });

      if (prevInternal && prevInternal.invoiceData && (prevInternal.invoiceData as any).bolsilloSolarSaldoFinal !== undefined) {
        bolsilloSolarSaldoInicial = Math.max(0, round2(Number((prevInternal.invoiceData as any).bolsilloSolarSaldoFinal) || 0));
      } else {
        const prevLegacy = await prisma.invoice.findFirst({
          where: {
            supplyPointId: supplyPoint.id,
            ...(f1.fechaInicio ? { billingEnd: { lte: f1.fechaInicio } } : {})
          },
          orderBy: { billingEnd: 'desc' }
        });
        if (prevLegacy && prevLegacy.invoiceData) {
          const ld: any = prevLegacy.invoiceData;
          const stored = Number(ld['Importe almacenado Bolsillo Solar'] ?? ld['Saldo Final Bolsillo Solar'] ?? 0);
          if (!isNaN(stored) && stored > 0) {
            bolsilloSolarSaldoInicial = round2(stored);
          }
        }
      }

      const availableSolarWallet = round2(bolsilloSolarSaldoInicial + bolsilloSolarLlenado);
      if (availableSolarWallet > 0 && totalSinDescuentoBolsillo > 0) {
        bolsilloSolarUso = round2(Math.min(availableSolarWallet, totalSinDescuentoBolsillo));
      }
      bolsilloSolarSaldoFinal = round2(Math.max(0, availableSolarWallet - bolsilloSolarUso));
    }

    const totalAmount = round2(totalSinDescuentoBolsillo - bolsilloSolarUso);

    const result: BillingCalculationResult = {
      hasMismatch,
      hasCriticalError,
      mismatchReason,
      totalCchMWh,
      totalF1MWh,
      billingDays,
      periods: periodsBreakdown,
      energyCost: totalEnergyCost,
      feeCost: totalCommercialMargin, // Margen total real (energía + potencia) tanto para Fijo como para Indexado
      capacityCost: 0,
      fneeCost: round2(totalFneeCostEur),
      reactiveEnergyCost,
      powerCost,
      peajesDistribuidora: totalPeajesEnergiaBOE,
      cargosDistribuidora: totalCargosEnergiaBOE,
      alquilerEquipo,
      bonoSocial,
      bonoSocialDailyRate,
      bonoSocialLabel,
      baseIEE,
      ieeRate,
      ieeReductionPct,
      taxElectric,
      svaCost,
      svaConcept,
      svaDetails,
      excesosPotencia,
      capacitiveEnergyCost,
      penalizacionNoIcpCost,
      recargoInfAnioCost,
      interesesDemoraCost,
      conceptosRepercutibles,
      conceptosRepercutiblesBase,
      conceptosRepercutiblesExempt,
      excedentesAutoconsumo,
      excedentesKwh: surplusKwhForOutput,
      pexc,
      maxExcedentes,
      hasBolsilloSolar,
      cgBolsilloSolarCost,
      cgBolsilloSolarDailyRate,
      bolsilloSolarSaldoInicial,
      bolsilloSolarLlenado,
      bolsilloSolarUso,
      bolsilloSolarSaldoFinal,
      totalBase,
      taxType,
      taxPercentage,
      taxAmount,
      taxBreakdown,
      totalSinDescuentoBolsillo,
      totalAmount,
      isFixed,
      isOtrasFacturas: false,
      powerDetails,
      energyAtrDetails,
      energyMarketDetails,
      energyMargin,
      powerMargin,
      f1Readings,
      meterSerialNumber,
      hourlyDetails,
      reactiveDetails,
      repairData: originalMismatchReason
        ? {
            issue: originalMismatchReason,
            f1Volume: totalF1MWh,
            cchVolume: originalCchMWh,
            hasCriticalError
          }
        : null
    };

    if (isAbono) {
      return invertBillingResult(result);
    }

    return result;
  }
}
