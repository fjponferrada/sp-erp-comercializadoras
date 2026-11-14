import { prisma } from '@/lib/prisma';
import { mapReadingCodeToIngebauLabel } from '@/lib/sipsCsvExporter';

export interface IngebauSipsData {
  result?: string;
  messages?: string;
  message?: string;
  code?: string;
  tarifa?: string;
  p1?: number | string;
  p2?: number | string;
  p3?: number | string;
  p4?: number | string;
  p5?: number | string;
  p6?: number | string;
  direccion?: string;
  poblacion?: string;
  municipio?: string;
  cp?: string;
  provincia?: string;
  codigoProvincia?: string;
  codigoMunicipio?: string;
  distribuidora?: string;
  codigoDistribuidora?: string;
  cnae?: string;
  autoconsumo?: string;
  consumo?: number;
  data?: {
    ps: Record<string, any>[];
    consumos: Record<string, any>[];
  };
  [key: string]: any;
}

const DEFAULT_SIPS_API_URL = 'https://api-sips-aeden-1090285260522.europe-southwest1.run.app';
const DEFAULT_SIPS_API_KEY = 'e8935e4a-27ds-443f-855e-a7a0c479e16e';

// Caché en memoria de municipios y provincias INE (8.203 municipios + 52 provincias)
let geoCachePromise: Promise<{
  municipalities: Map<string, string>;
  provinces: Map<string, string>;
}> | null = null;

async function getGeoMaps() {
  if (!geoCachePromise) {
    geoCachePromise = (async () => {
      try {
        const [muns, provs] = await Promise.all([
          prisma.municipality.findMany({ select: { code: true, name: true } }),
          prisma.province.findMany({ select: { code: true, name: true } }),
        ]);
        const municipalities = new Map<string, string>();
        for (const m of muns) {
          municipalities.set(m.code.trim(), m.name.trim());
          municipalities.set(m.code.trim().padStart(5, '0'), m.name.trim());
        }
        const provinces = new Map<string, string>();
        for (const p of provs) {
          provinces.set(p.code.trim(), p.name.trim());
          provinces.set(p.code.trim().padStart(2, '0'), p.name.trim());
        }
        return { municipalities, provinces };
      } catch (err) {
        console.warn('[SIPS] No se pudieron precargar mapas INE desde BD:', err);
        geoCachePromise = null;
        return { municipalities: new Map(), provinces: new Map() };
      }
    })();
  }
  return geoCachePromise;
}

// Caché temporal de consultas por CUPS20 (10 minutos) para acelerar navegación Cotizador / Leads / CSV
const SIPS_CACHE_TTL_MS = 10 * 60 * 1000;
const sipsLookupCache = new Map<string, { expiresAt: number; payload: IngebauSipsData }>();

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

function parseYmdUtcMs(ymd: unknown): number {
  if (!ymd || typeof ymd !== 'string') return 0;
  const m = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function translateTariffCnmc(rawCode: unknown, rawProfile?: unknown): string {
  const c = String(rawCode ?? '').trim().toUpperCase();
  const map: Record<string, string> = {
    '018': '2.0TD',
    '18': '2.0TD',
    '019': '3.0TD',
    '19': '3.0TD',
    '020': '6.1TD',
    '20': '6.1TD',
    '021': '6.2TD',
    '21': '6.2TD',
    '022': '6.3TD',
    '22': '6.3TD',
    '023': '6.4TD',
    '23': '6.4TD',
    '024': '3.0TDVE',
    '24': '3.0TDVE',
    '026': '3.0TDVE',
    '025': '6.1TDVE',
    '25': '6.1TDVE',
    '027': '6.1TDVE',
    // Códigos históricos pre-Circular 3/2020 por si aparecen en lecturas antiguas
    '001': '2.0TD',
    '003': '3.0TD',
    '004': '2.0TD',
    '005': '2.0TD',
    '006': '2.0TD',
    '007': '2.0TD',
    '008': '2.0TD',
    '011': '3.0TD',
    '012': '6.1TD',
    '013': '6.2TD',
    '014': '6.3TD',
    '015': '6.4TD',
    '016': '6.1TD',
    '017': '2.0TD',
  };
  if (map[c]) return map[c];
  if (c.includes('TD')) return c;

  const prof = String(rawProfile ?? '').trim().toUpperCase();
  if (prof.startsWith('P') && prof.includes('TD')) {
    return prof.substring(1);
  }
  return c || '2.0TD';
}

function translateTensionCnmc(rawCode: unknown): string {
  const c = String(rawCode ?? '').trim().padStart(2, '0');
  const map: Record<string, string> = {
    '01': '1X127',
    '02': '1X230',
    '03': '1X220',
    '04': '3X230',
    '05': '3X380',
    '06': '3X400',
    '07': '1X230/400',
    '08': '3X230/400',
    '09': '1KV-11KV',
    '10': '11KV-15KV',
    '11': '15KV-20KV',
    '12': '20KV',
    '13': '20KV-30KV',
    '14': '30KV',
    '15': '30KV-45KV',
    '16': '45KV-66KV',
    '17': '66KV-110KV',
    '18': '110KV-132KV',
    '19': '132KV-220KV',
    '20': '220KV-400KV',
  };
  if (!rawCode) return '';
  return map[c] || String(rawCode).trim();
}

function translateTipoPmCnmc(rawCode: unknown): string {
  const c = String(rawCode ?? '').trim().padStart(2, '0');
  const map: Record<string, string> = {
    '01': 'Tipo 1',
    '02': 'Tipo 2',
    '03': 'Tipo 3',
    '04': 'Tipo 4',
    '05': 'Tipo 5',
  };
  if (!rawCode) return '';
  return map[c] || String(rawCode).trim();
}

function translateOwnershipCnmc(rawCode: unknown): string {
  const c = String(rawCode ?? '').trim();
  if (c === '1' || c === '01') return 'Distribuidor';
  if (c === '2' || c === '02') return 'Cliente';
  if (c === '3' || c === '03') return 'Comercializador';
  if (c === '4' || c === '04') return 'Otros';
  return c;
}

function translateTelegestionCnmc(rawCode: unknown): string {
  const c = String(rawCode ?? '').trim().padStart(2, '0');
  if (c === '01') return 'Telegestión operativa con curva de carga horaria';
  if (c === '02') return 'Telegestión operativa sin curva de carga horaria';
  if (c === '03') return 'Sin telegestión';
  return String(rawCode ?? '').trim();
}

function wattsToKwNumber(rawW: unknown): number {
  if (rawW === null || rawW === undefined || rawW === '') return 0;
  const n = Number(String(rawW).replace(',', '.'));
  if (!Number.isFinite(n) || n === 0) return 0;
  return round3(n / 1000);
}

function wattsToKwString(rawW: unknown, emptyAsZero: boolean = true): string {
  if (rawW === null || rawW === undefined || String(rawW).trim() === '') {
    return emptyAsZero ? '0' : '';
  }
  const kw = wattsToKwNumber(rawW);
  return String(kw);
}

function stripLeadingZerosIfInt(raw: unknown, fallback: string = ''): string {
  const s = String(raw ?? '').trim();
  if (!s) return fallback;
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s;
}

function normalizeAutoconsumoCode(rawCode: unknown): string {
  const c = String(rawCode ?? '').trim();
  if (!c || c === '00' || c === '0') return '0';
  return c;
}

/**
 * Transforma la respuesta cruda de nuestra API Google Cloud Run / BigQuery
 * (columnas CNMC en minúsculas y unidades W / Wh) al contrato JSON exacto
 * que devolvía Ingebau, manteniendo el 100% de compatibilidad con todo el ERP.
 */
async function transformCloudSipsToIngebau(rawApiData: any, requestedCups: string): Promise<IngebauSipsData | null> {
  // Si ya viniera en formato Ingebau (p.ej. test o caché legacy), devolver tal cual
  if (rawApiData?.data?.ps && Array.isArray(rawApiData.data.ps)) {
    return rawApiData as IngebauSipsData;
  }

  const rawPs = Array.isArray(rawApiData?.ps) ? rawApiData.ps[0] : rawApiData?.ps;
  if (!rawPs || typeof rawPs !== 'object') {
    return null;
  }

  const rawConsumosList: any[] = Array.isArray(rawApiData?.consumos) ? rawApiData.consumos : [];
  const { municipalities, provinces } = await getGeoMaps();

  const rawMunCode = String(rawPs.municipiops ?? '').trim();
  const paddedMunCode = rawMunCode ? rawMunCode.padStart(5, '0') : '';
  const municipalityName =
    municipalities.get(paddedMunCode) ||
    municipalities.get(rawMunCode) ||
    rawMunCode;

  const rawProvCode = String(rawPs.codigoprovinciaps ?? '').trim();
  const paddedProvCode = rawProvCode ? rawProvCode.padStart(2, '0') : '';
  const provinceName =
    provinces.get(paddedProvCode) ||
    provinces.get(rawProvCode) ||
    rawProvCode;

  const psTariff = translateTariffCnmc(rawPs.codigotarifaatrenvigor, rawPs.tipoperfilconsumo);
  const fullCups = String(rawPs.cups || requestedCups).trim().toUpperCase();

  // Ordenar lecturas de más reciente a más antigua (igual que Ingebau y UniEléctrica)
  const sortedRawConsumos = [...rawConsumosList].sort((a, b) => {
    const endDiff = parseYmdUtcMs(b?.fechafinmesconsumo) - parseYmdUtcMs(a?.fechafinmesconsumo);
    if (endDiff !== 0) return endDiff;
    return parseYmdUtcMs(b?.fechainiciomesconsumo) - parseYmdUtcMs(a?.fechainiciomesconsumo);
  });

  // Cálculo exacto de ConsumoAnualP1..P6kWh y ConsumoAnualkWh (ventana de 365 días desde la última lectura)
  let maxEndMs = 0;
  for (const row of sortedRawConsumos) {
    const endMs = parseYmdUtcMs(row?.fechafinmesconsumo);
    if (endMs > maxEndMs) maxEndMs = endMs;
  }
  const cutoff1YearMs = maxEndMs > 0 ? maxEndMs - 365 * 86_400_000 : 0;
  const cutoff2YearMs = maxEndMs > 0 ? maxEndMs - 730 * 86_400_000 : 0;

  let annualWh = [0, 0, 0, 0, 0, 0];
  let matchedCurrentYearCycles = 0;
  let prevYearWhTotal = 0;

  for (const row of sortedRawConsumos) {
    const startMs = parseYmdUtcMs(row?.fechainiciomesconsumo);
    const endMs = parseYmdUtcMs(row?.fechafinmesconsumo);
    if (maxEndMs > 0 && startMs >= cutoff1YearMs && endMs <= maxEndMs) {
      matchedCurrentYearCycles++;
      for (let idx = 0; idx < 6; idx++) {
        const valWh = Number(row?.[`consumoenergiaactivaenwhp${idx + 1}`] ?? 0);
        if (Number.isFinite(valWh)) annualWh[idx] += valWh;
      }
    } else if (maxEndMs > 0 && startMs >= cutoff2YearMs && endMs <= cutoff1YearMs + 35 * 86_400_000 && startMs < cutoff1YearMs) {
      for (let idx = 0; idx < 6; idx++) {
        const valWh = Number(row?.[`consumoenergiaactivaenwhp${idx + 1}`] ?? 0);
        if (Number.isFinite(valWh)) prevYearWhTotal += valWh;
      }
    }
  }

  // Fallback defensivo si solo hubiera una lectura plurianual cuyo inicio sea anterior a 365d
  if (matchedCurrentYearCycles === 0 && sortedRawConsumos.length > 0) {
    for (const row of sortedRawConsumos) {
      const endMs = parseYmdUtcMs(row?.fechafinmesconsumo);
      if (maxEndMs === 0 || endMs > cutoff1YearMs) {
        for (let idx = 0; idx < 6; idx++) {
          const valWh = Number(row?.[`consumoenergiaactivaenwhp${idx + 1}`] ?? 0);
          if (Number.isFinite(valWh)) annualWh[idx] += valWh;
        }
      }
    }
  }

  const annualP1 = round2(annualWh[0] / 1000);
  const annualP2 = round2(annualWh[1] / 1000);
  const annualP3 = round2(annualWh[2] / 1000);
  const annualP4 = round2(annualWh[3] / 1000);
  const annualP5 = round2(annualWh[4] / 1000);
  const annualP6 = round2(annualWh[5] / 1000);
  const annualTotalKwh = round2(annualP1 + annualP2 + annualP3 + annualP4 + annualP5 + annualP6);
  const annualPrevKwh = round2(prevYearWhTotal / 1000);

  // Transformar cada ciclo de lectura al formato exacto de data.consumos[] de Ingebau
  const consumosMapped = sortedRawConsumos.map((c) => {
    const cTariff = translateTariffCnmc(c?.codigotarifaatr, rawPs.tipoperfilconsumo) || psTariff;
    const codTipoLectura = String(c?.codigotipolectura ?? '').trim();
    return {
      CUPS: String(c?.cups || fullCups).trim().toUpperCase(),
      TarifaATR: cTariff,
      LecturaDesde: c?.fechainiciomesconsumo ?? '',
      LecturaHasta: c?.fechafinmesconsumo ?? '',
      TipoLectura: mapReadingCodeToIngebauLabel(codTipoLectura),
      codigoTipoLectura: codTipoLectura,
      codigoDHEquipoDeMedida: stripLeadingZerosIfInt(c?.codigodhequipodemedida),
      'EnergiaActivaP1(kWh)': Math.round(Number(c?.consumoenergiaactivaenwhp1 ?? 0) / 1000),
      'EnergiaActivaP2(kWh)': Math.round(Number(c?.consumoenergiaactivaenwhp2 ?? 0) / 1000),
      'EnergiaActivaP3(kWh)': Math.round(Number(c?.consumoenergiaactivaenwhp3 ?? 0) / 1000),
      'EnergiaActivaP4(kWh)': Math.round(Number(c?.consumoenergiaactivaenwhp4 ?? 0) / 1000),
      'EnergiaActivaP5(kWh)': Math.round(Number(c?.consumoenergiaactivaenwhp5 ?? 0) / 1000),
      'EnergiaActivaP6(kWh)': Math.round(Number(c?.consumoenergiaactivaenwhp6 ?? 0) / 1000),
      'MaxímetroP1(kW)': wattsToKwNumber(c?.potenciademandadaenwp1),
      'MaxímetroP2(kW)': wattsToKwNumber(c?.potenciademandadaenwp2),
      'MaxímetroP3(kW)': wattsToKwNumber(c?.potenciademandadaenwp3),
      'MaxímetroP4(kW)': wattsToKwNumber(c?.potenciademandadaenwp4),
      'MaxímetroP5(kW)': wattsToKwNumber(c?.potenciademandadaenwp5),
      'MaxímetroP6(kW)': wattsToKwNumber(c?.potenciademandadaenwp6),
      'EnergíaReactivaP1(Varh)': Math.round(Number(c?.consumoenergiareactivaenvarhp1 ?? 0)),
      'EnergíaReactivaP2(Varh)': Math.round(Number(c?.consumoenergiareactivaenvarhp2 ?? 0)),
      'EnergíaReactivaP3(Varh)': Math.round(Number(c?.consumoenergiareactivaenvarhp3 ?? 0)),
      'EnergíaReactivaP4(Varh)': Math.round(Number(c?.consumoenergiareactivaenvarhp4 ?? 0)),
      'EnergíaReactivaP5(Varh)': Math.round(Number(c?.consumoenergiareactivaenvarhp5 ?? 0)),
      'EnergíaReactivaP6(Varh)': Math.round(Number(c?.consumoenergiareactivaenvarhp6 ?? 0)),
    };
  });

  const rawDistCode = String(rawPs.codigoempresadistribuidora ?? '').trim();
  const normalizedDistCode = /^\d+$/.test(rawDistCode) ? String(parseInt(rawDistCode, 10)) : rawDistCode;

  const p1Kw = wattsToKwNumber(rawPs.potenciascontratadasenwp1);
  const p2Kw = wattsToKwNumber(rawPs.potenciascontratadasenwp2);
  const p3Kw = wattsToKwNumber(rawPs.potenciascontratadasenwp3);
  const p4Kw = wattsToKwNumber(rawPs.potenciascontratadasenwp4);
  const p5Kw = wattsToKwNumber(rawPs.potenciascontratadasenwp5);
  const p6Kw = wattsToKwNumber(rawPs.potenciascontratadasenwp6);

  const autoconsumoNorm = normalizeAutoconsumoCode(rawPs.codigoautoconsumo);

  const psMapped: Record<string, any> = {
    CNAE: String(rawPs.cnae ?? ''),
    CUPS: fullCups,
    TipoPM: translateTipoPmCnmc(rawPs.codigoclasificacionps),
    codigoClasificacionPS: String(rawPs.codigoclasificacionps ?? ''),
    Tension: translateTensionCnmc(rawPs.codigotensionv),
    IDTitular: String(rawPs.tipoidtitular ?? ''),
    TarifaATR: psTariff,
    codigoBIE: String(rawPs.codigobie ?? '0'),
    FechaAltaPS: String(rawPs.fechaaltasuministro ?? ''),
    MunicipioPS: municipalityName,
    codigoMunicipioINE: paddedMunCode,
    ProvinciaPS: provinceName,
    potenciaCGPW: wattsToKwString(rawPs.potenciacgpw, false),
    'Propietario EM': translateOwnershipCnmc(rawPs.codigopropiedadequipomedida),
    ConsumoAnualkWh: annualTotalKwh,
    CódigoPostalPS: String(rawPs.codigopostalps ?? ''),
    fechaEmisionBIE: String(rawPs.fechaemisionbie ?? ''),
    ConsumoAnualP1kWh: annualP1,
    ConsumoAnualP2kWh: annualP2,
    ConsumoAnualP3kWh: annualP3,
    ConsumoAnualP4kWh: annualP4,
    ConsumoAnualP5kWh: annualP5,
    ConsumoAnualP6kWh: annualP6,
    codigoAutoconsumo: autoconsumoNorm,
    codigoProvinciaPS: paddedProvCode || rawProvCode,
    codigoTelegestion: translateTelegestionCnmc(rawPs.codigotelegestion),
    fechaCaducidadBIE: String(rawPs.fechacaducidadbie ?? ''),
    tipoPerfilConsumo: String(rawPs.tipoperfilconsumo ?? ''),
    'PotenciaMaxBIE(kW)': wattsToKwString(rawPs.potenciamaximabiew, false),
    codigoPropiedadICP: translateOwnershipCnmc(rawPs.codigopropiedadicp),
    codigoTipoContrato: stripLeadingZerosIfInt(rawPs.codigotipocontrato),
    esViviendaHabitual: stripLeadingZerosIfInt(rawPs.esviviendahabitual, '0'),
    fechaUltimaLectura: String(rawPs.fechaultimalectura ?? ''),
    informacionImpagos: stripLeadingZerosIfInt(rawPs.informacionimpagos, '0'),
    NombreDistribuidora: String(rawPs.nombreempresadistribuidora ?? ''),
    codigoPSContratable: stripLeadingZerosIfInt(rawPs.codigopscontratable, '1'),
    motivoEstadoNoContratable: String(rawPs.motivoestadonocontratable ?? ''),
    ConsumoAnualAnterior: annualPrevKwh,
    CódigoDistribuidora: normalizedDistCode,
    codigoEmpresaDistribuidoraREE: rawDistCode.padStart(4, '0'),
    aplicacionBonoSocial: String(rawPs.aplicacionbonosocial ?? '0'),
    codigoTipoSuministro: String(rawPs.codigotiposuministro ?? ''),
    'potenciaMaximaAPM(KW)': wattsToKwString(rawPs.potenciamaximaapmw, false),
    valorDerechosAccesokW: wattsToKwString(rawPs.valorderechosaccesow, false),
    PotenciaContratadaP1kW: String(p1Kw),
    PotenciaContratadaP2kW: String(p2Kw),
    PotenciaContratadaP3kW: String(p3Kw),
    PotenciaContratadaP4kW: String(p4Kw),
    PotenciaContratadaP5kW: String(p5Kw),
    PotenciaContratadaP6kW: String(p6Kw),
    codigoDHEquipoDeMedida: stripLeadingZerosIfInt(rawPs.codigodhequipodemedida),
    codigoDisponibilidadICP: stripLeadingZerosIfInt(rawPs.codigodisponibilidadicp),
    codigoFasesEquipoMedida: String(rawPs.codigofasesequipomedida ?? ''),
    relacionTransformacionIntensidad: String(rawPs.relaciontransformacionintensidad ?? ''),
    valorDerechosExtensionkW: wattsToKwString(rawPs.valorderechosextensionw, false),
    codigoModoControlPotencia: stripLeadingZerosIfInt(rawPs.codigomodocontrolpotencia),
    importeDepositoGarantiaEuros: stripLeadingZerosIfInt(rawPs.importedepositogarantiaeuros, '0'),
    codigoPeriodicidadFacturacion: stripLeadingZerosIfInt(rawPs.codigoperiodicidadfacturacion),
    fechaUltimoMovimientoContrato: String(rawPs.fechaultimomovimientocontrato ?? ''),
    fechaLimiteDerechosReconocidos: String(rawPs.fechalimitederechosreconocidos ?? ''),
    fechaUltimoCambioComercializador: String(rawPs.fechaultimocambiocomercializador ?? ''),
  };

  return {
    result: 'OK',
    messages: '',
    tarifa: psTariff,
    p1: p1Kw,
    p2: p2Kw,
    p3: p3Kw,
    p4: p4Kw,
    p5: p5Kw,
    p6: p6Kw,
    cp: psMapped.CódigoPostalPS,
    poblacion: municipalityName,
    municipio: municipalityName,
    provincia: provinceName,
    codigoProvincia: psMapped.codigoProvinciaPS,
    codigoMunicipio: paddedMunCode,
    distribuidora: psMapped.NombreDistribuidora,
    codigoDistribuidora: rawDistCode.padStart(4, '0'),
    cnae: psMapped.CNAE,
    autoconsumo: autoconsumoNorm,
    consumo: annualTotalKwh,
    data: {
      ps: [psMapped],
      consumos: consumosMapped,
    },
  };
}

/**
 * Consulta nuestra API SIPS corporativa en Google Cloud Run + BigQuery
 * y traduce los resultados al contrato exacto de Ingebau usado por todo el ERP.
 */
export async function getSipsData(cups: string, options?: { skipCache?: boolean }): Promise<IngebauSipsData | null> {
  const cleanCups = (cups || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cleanCups || cleanCups.length < 20) {
    console.warn(`[SIPS] CUPS inválido para consultar SIPS: ${cups}`);
    return null;
  }

  const cups20 = cleanCups.substring(0, 20);
  if (!options?.skipCache) {
    const cached = sipsLookupCache.get(cups20);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }
  }

  const baseUrl = (process.env.SIPS_API_URL || DEFAULT_SIPS_API_URL).replace(/\/+$/, '');
  const apiKey = process.env.SIPS_API_KEY || DEFAULT_SIPS_API_KEY;

  try {
    const url = `${baseUrl}/cups/${encodeURIComponent(cleanCups)}`;
    console.log(`[SIPS] Consultando API SIPS corporativa para CUPS: ${cleanCups}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    if (response.status === 404) {
      return {
        result: 'ERROR',
        code: '404',
        messages: `El CUPS ${cleanCups} no figura en la base de datos nacional SIPS.`,
        message: `El CUPS ${cleanCups} no figura en la base de datos nacional SIPS.`,
      };
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[SIPS] Error HTTP ${response.status} de API SIPS:`, errText);
      return {
        result: 'ERROR',
        code: String(response.status),
        messages: `Error al consultar SIPS (HTTP ${response.status})`,
        message: `Error al consultar SIPS (HTTP ${response.status})`,
      };
    }

    const rawJson = await response.json();
    const transformed = await transformCloudSipsToIngebau(rawJson, cleanCups);

    if (!transformed) {
      return {
        result: 'ERROR',
        code: '404',
        messages: `No se encontraron datos de Punto de Suministro en SIPS para ${cleanCups}.`,
        message: `No se encontraron datos de Punto de Suministro en SIPS para ${cleanCups}.`,
      };
    }

    // Limitar tamaño máximo de caché en memoria a 500 entradas
    if (sipsLookupCache.size >= 500) {
      const firstKey = sipsLookupCache.keys().next().value;
      if (firstKey) sipsLookupCache.delete(firstKey);
    }
    sipsLookupCache.set(cups20, {
      expiresAt: Date.now() + SIPS_CACHE_TTL_MS,
      payload: transformed,
    });

    console.log(`[SIPS] Lectura exitosa para CUPS: ${cleanCups} (${transformed.tarifa} | ${transformed.consumo} kWh/año)`);
    return transformed;
  } catch (error: any) {
    console.error(`[SIPS] Excepción al consultar API SIPS corporativa:`, error);
    const isTimeout = error?.name === 'AbortError';
    return {
      result: 'ERROR',
      code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      messages: isTimeout
        ? 'Tiempo de espera agotado consultando SIPS. Inténtalo de nuevo en unos segundos.'
        : 'Error de conexión con el servidor SIPS.',
      message: isTimeout
        ? 'Tiempo de espera agotado consultando SIPS. Inténtalo de nuevo en unos segundos.'
        : 'Error de conexión con el servidor SIPS.',
    };
  }
}
