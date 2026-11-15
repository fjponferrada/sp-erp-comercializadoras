/**
 * Utilidades compartidas para la extracción financiera, normalización de fechas/periodos
 * y metadatos CNMC de ficheros F1 (FacturaATR y OtrasFacturas - Proceso F1 CNMC).
 */

export interface F1PeriodPowerDetail {
  periodo: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  potenciaContratadaKw: number;
  potenciaAFacturarKw: number;
  potenciaMaxDemandadaKw: number;
  precioKwDia: number;
}

export interface F1PeriodEnergyDetail {
  periodo: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  energiaKwh: number;
  precioKwh: number;
}

export interface F1CargoBlockDetail {
  tipoCargo: string;
  etiqueta: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  importeTotal: number;
}

export interface F1TaxBracketDetail {
  tipo: string;
  baseImponible: number;
  porcentaje: number;
  importe: number;
}

export interface F1ConceptoRepercutibleDetail {
  codigo: string;
  descripcion: string;
  fechaOperacion: string | null;
  unidades: number;
  precioUnidad: number;
  importeTotal: number;
  comentarios: string | null;
}

export interface ExtractedF1Data {
  tipoDocumento: 'FacturaATR' | 'OtrasFacturas';
  tipoFactura: string;
  tipoFacturaLabel: string;
  motivoFacturacion: string | null;
  motivoFacturacionLabel: string | null;
  codigoFiscal: string | null;
  codigoRectificada: string | null;
  codigoAbono: string | null;
  cups: string | null;
  tarifaAtrCode: string | null;
  tarifaAtrLabel: string | null;
  identificadorEmisora: string | null;
  fechaFacturaIso: string | null;
  fechaDesdeIso: string | null;
  fechaHastaIso: string | null;
  numeroDias: number | null;
  totalEnergiaKwh: number;
  totalExcedentesKwh: number;
  potenciaEur: number;
  energiaActivaEur: number;
  excesosEur: number;
  reactivaEur: number;
  capacitivaEur: number;
  totalPeajes: number;
  totalCargos: number;
  alquileresEur: number;
  impuestoElectricoBase: number;
  impuestoElectricoPct: number;
  impuestoElectricoEur: number;
  conceptosRepercutiblesEur: number;
  baseImponible: number;
  ivaEur: number;
  importeTotalFactura: number;
  saldoFacturaXml: number | null;
  hasDistinctSaldo: boolean;
  comentarios: string | null;
  potenciaPeriodos: F1PeriodPowerDetail[];
  energiaPeriodos: F1PeriodEnergyDetail[];
  cargosDetalle: F1CargoBlockDetail[];
  impuestosDetalle: F1TaxBracketDetail[];
  conceptosRepercutiblesDetalle: F1ConceptoRepercutibleDetail[];
}

export function parseCnmcNumber(val: unknown): number {
  if (val === undefined || val === null) return 0;
  const unwrapped = Array.isArray(val) ? val[0] : val;
  if (unwrapped === undefined || unwrapped === null || typeof unwrapped === 'object') return 0;
  if (typeof unwrapped === 'number') return Number.isFinite(unwrapped) ? unwrapped : 0;
  const cleaned = String(unwrapped).trim().replace(',', '.');
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function asArray<T>(val: T | T[] | null | undefined): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function unwrapScalarString(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  const unwrapped = Array.isArray(val) ? val[0] : val;
  if (unwrapped === undefined || unwrapped === null || typeof unwrapped === 'object') return null;
  const s = String(unwrapped).trim();
  return s.length > 0 ? s : null;
}

export function normalizeIsoDate(val: unknown): string | null {
  const s = unwrapScalarString(val);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

export const CNMC_TIPO_FACTURA_LABELS: Record<string, string> = {
  N: 'Normal',
  R: 'Rectificadora',
  A: 'Anuladora',
  AR: 'Abono Rectif.',
  S: 'Sustitutiva / Abono',
  G: 'Regularizadora',
  C: 'Complementaria',
};

export const CNMC_TARIFA_ATR_LABELS: Record<string, string> = {
  '1': '2.0A',
  '001': '2.0A',
  '3': '3.0A',
  '003': '3.0A',
  '4': '2.0DHA',
  '004': '2.0DHA',
  '11': '3.1A',
  '011': '3.1A',
  '12': '6.1A',
  '012': '6.1A',
  '18': '2.0TD',
  '018': '2.0TD',
  '19': '3.0TD',
  '019': '3.0TD',
  '20': '6.1TD',
  '020': '6.1TD',
  '21': '6.2TD',
  '021': '6.2TD',
  '22': '6.3TD',
  '022': '6.3TD',
  '23': '6.4TD',
  '023': '6.4TD',
  '24': '3.0TDVE',
  '024': '3.0TDVE',
  '25': '6.1TDVE',
  '025': '6.1TDVE',
  '26': '6.2TDVE',
  '026': '6.2TDVE',
};

export const CNMC_MOTIVO_FACTURACION_LABELS: Record<string, string> = {
  '1': 'Periódica / Verificación',
  '01': 'Periódica / Verificación',
  '2': 'Baja de contrato / Derechos',
  '02': 'Baja de contrato / Derechos',
  '3': 'Modificación / Rectificación',
  '03': 'Modificación / Rectificación',
  '4': 'Fianza / Depósito garantía',
  '04': 'Fianza / Depósito garantía',
  '5': 'Inspección / Fraude',
  '05': 'Inspección / Fraude',
  '6': 'Devolución de Fianza',
  '06': 'Devolución de Fianza',
  '7': 'Indemnización calidad suministro',
  '07': 'Indemnización calidad suministro',
  '8': 'Cambio comercializador',
  '08': 'Cambio comercializador',
  '9': 'Otros conceptos repercutibles',
  '09': 'Otros conceptos repercutibles',
};

export const CNMC_CONCEPTO_REPERCUTIBLE_LABELS: Record<string, string> = {
  '1': 'Indemnización incumplimiento calidad individual',
  '01': 'Indemnización incumplimiento calidad individual',
  '2': 'Derechos de acometida / extensión',
  '02': 'Derechos de acometida / extensión',
  '3': 'Derechos de acceso',
  '03': 'Derechos de acceso',
  '4': 'Derechos de enganche',
  '04': 'Derechos de enganche',
  '5': 'Derechos de verificación',
  '05': 'Derechos de verificación',
  '6': 'Depósito de garantía (Fianza)',
  '06': 'Depósito de garantía (Fianza)',
  '7': 'Gastos de anulación / actuación en equipo',
  '07': 'Gastos de anulación / actuación en equipo',
  '12': 'Derechos de supervisión',
  '16': 'Actuaciones en equipos de medida',
};

const KNOWN_DISTRIBUTORS_BY_REE: Record<string, { name: string; shortName: string }> = {
  '0031': { name: '[0031] EDISTRIBUCION REDES DIGITALES SL.', shortName: 'e-distribución (0031)' },
  '0021': { name: '[0021] I-DE REDES ELÉCTRICAS INTELIGENTES, S.A.U', shortName: 'i-DE Iberdrola (0021)' },
  '0022': { name: '[0022] UNIÓN FENOSA DISTRIBUCIÓN, S.A.', shortName: 'UFD Naturgy (0022)' },
  '0026': { name: '[0026] HIDROCANTÁBRICO DISTRIBUCIÓN ELÉCTRICA, S.A.', shortName: 'E-REDES EDP (0026)' },
  '0027': { name: '[0027] VIESGO DISTRIBUCIÓN ELÉCTRICA, S.L.', shortName: 'Viesgo (0027)' },
  '0033': { name: '[0033] BARRAS ELÉCTRICAS GALAICO-ASTURIANAS, S.A.', shortName: 'Begasa (0033)' },
  '0034': { name: '[0034] SUMINISTRADORA ELECTRICA DE CADIZ, S.A.', shortName: 'Eléctrica de Cádiz (0034)' },
  '0113': { name: '[0113] ESTABANELL Y PAHISA ENERGÍA, S.A.', shortName: 'Estabanell (0113)' },
  '0129': { name: '[0129] CENTRAL ELECTRICA SAN FRANCISCO, S.L.', shortName: 'San Francisco (0129)' },
  '0143': { name: '[0143] DIELESUR, SL', shortName: 'Dielesur (0143)' },
  '0274': { name: '[0274] EMILIO PADILLA E HIJOS SL', shortName: 'Emilio Padilla (0274)' },
  '0294': { name: '[0294] HEREDEROS DE EMILIO GAMERO SL', shortName: 'Emilio Gamero (0294)' },
  '0364': { name: '[0364] VARGAS Y COMPAÑIA ELECTRO HARINERA SAN RAMON S.A.', shortName: 'Vargas y Cía (0364)' },
};

const KNOWN_DISTRIBUTORS_BY_CIF: Record<string, string> = {
  B82846817: '0031', // EDISTRIBUCION
  A95075578: '0021', // I-DE
  A63222533: '0022', // UFD NATURGY
  A33503780: '0026', // HIDROCANTABRICO / E-REDES
  B39008074: '0027', // VIESGO
};

export function resolveDistributorInfo(
  cups?: string | null,
  spDistributor?: string | null,
  identificadorEmisora?: string | null
): { code: string; name: string; shortName: string } {
  const cleanCups = (cups || '').trim().toUpperCase();
  let reeCode = '';
  if (/^ES\d{4}/.test(cleanCups)) {
    reeCode = cleanCups.slice(2, 6);
  }
  if (!reeCode && spDistributor) {
    const match = spDistributor.match(/\[?(\d{4})\]?/);
    if (match) reeCode = match[1];
  }
  if (!reeCode && identificadorEmisora) {
    const cleanCif = identificadorEmisora.trim().toUpperCase();
    if (KNOWN_DISTRIBUTORS_BY_CIF[cleanCif]) {
      reeCode = KNOWN_DISTRIBUTORS_BY_CIF[cleanCif];
    }
  }

  if (reeCode && KNOWN_DISTRIBUTORS_BY_REE[reeCode]) {
    return {
      code: reeCode,
      ...KNOWN_DISTRIBUTORS_BY_REE[reeCode],
    };
  }

  if (spDistributor && spDistributor.trim()) {
    const cleanDist = spDistributor.trim();
    const withPrefix = reeCode && !cleanDist.startsWith('[') ? `[${reeCode}] ${cleanDist}` : cleanDist;
    const shortRaw = cleanDist.replace(/^\[\d{4}\]\s*/, '').slice(0, 26);
    return {
      code: reeCode || 'OTRA',
      name: withPrefix,
      shortName: reeCode ? `${shortRaw} (${reeCode})` : shortRaw,
    };
  }

  if (reeCode) {
    return {
      code: reeCode,
      name: `[${reeCode}] Distribuidora ${reeCode}`,
      shortName: `Distr. (${reeCode})`,
    };
  }

  return {
    code: 'DESCONOCIDA',
    name: 'Sin identificar',
    shortName: 'Sin identificar',
  };
}

/**
 * Extrae con precisión todos los importes, consumos, periodos y metadatos de un nodo XML F1 (jsonData).
 * Gestiona automáticamente:
 * - Decimales con coma española ("-13,46") o punto / number JS.
 * - Arrays vs objetos únicos en TerminoEnergiaActiva, TerminoPotencia, IVA, ConceptoRepercutible (Regla 201).
 * - Signos incoherentes en abonos/anuladoras (p. ej. Endesa envía BaseImponible positiva en AR/S negativos,
 *   o envía componentes positivos en facturas TipoFactura='A' con ImporteTotalFactura negativo).
 * - Facturas exentas en OtrasFacturas (fianzas/depósitos donde IVA.BaseImponible = 0 pero ConceptoRepercutible != 0).
 */
export function extractF1Financials(
  rawJson: any,
  fallbackDocType?: string | null,
  numeroFacturaFallback?: string | null
): ExtractedF1Data {
  const j =
    rawJson?.FacturaATR ||
    rawJson?.OtrasFacturas ||
    rawJson?.Facturas?.FacturaATR ||
    rawJson?.Facturas?.OtrasFacturas ||
    rawJson ||
    {};

  const isOtras =
    Boolean(j?.DatosGeneralesOtrasFacturas) ||
    (!j?.DatosGeneralesFacturaATR && fallbackDocType === 'OtrasFacturas');
  const tipoDocumento: 'FacturaATR' | 'OtrasFacturas' = isOtras ? 'OtrasFacturas' : 'FacturaATR';

  const dGenRoot = isOtras ? j?.DatosGeneralesOtrasFacturas || {} : j?.DatosGeneralesFacturaATR || {};
  const dGen = dGenRoot?.DatosGeneralesFactura || j?.DatosGeneralesFactura || {};
  const dFact = dGenRoot?.DatosFacturaATR || j?.DatosFacturaATR || {};

  const rawTipo = unwrapScalarString(dGen?.TipoFactura);
  const tipoFactura = (
    rawTipo ||
    (String(numeroFacturaFallback || '').startsWith('AR-') ? 'AR' : 'N')
  ).toUpperCase();
  const tipoFacturaLabel = CNMC_TIPO_FACTURA_LABELS[tipoFactura] || tipoFactura;

  const motivoFacturacion = unwrapScalarString(dGen?.MotivoFacturacion);
  const motivoFacturacionLabel = motivoFacturacion
    ? CNMC_MOTIVO_FACTURACION_LABELS[motivoFacturacion] || `Motivo ${motivoFacturacion}`
    : null;

  const codigoFiscal = unwrapScalarString(dGen?.CodigoFiscalFactura) || numeroFacturaFallback || null;
  const codigoRectificada = unwrapScalarString(dGen?.CodigoFacturaRectificadaAnulada);
  const codigoAbono = unwrapScalarString(dGen?.CodigoFacturaAbono);
  const identificadorEmisora = unwrapScalarString(dGen?.IdentificadorEmisora);
  const comentarios = unwrapScalarString(dGen?.Comentarios);

  const cups =
    unwrapScalarString(dGenRoot?.DireccionSuministro?.CUPS) ||
    unwrapScalarString(j?.Medidas?.CodPM) ||
    unwrapScalarString(j?.CodPM) ||
    null;

  const tarifaAtrCode = unwrapScalarString(dFact?.TarifaATRFact || dFact?.CodigoTarifa);
  const tarifaAtrLabel = tarifaAtrCode
    ? CNMC_TARIFA_ATR_LABELS[tarifaAtrCode] || `Cód. ${tarifaAtrCode}`
    : null;

  const fechaFacturaIso = normalizeIsoDate(dGen?.FechaFactura);
  const periodoHeader = Array.isArray(dFact?.Periodo) ? dFact.Periodo[0] : dFact?.Periodo;
  const fechaDesdeIso = normalizeIsoDate(periodoHeader?.FechaDesdeFactura || dFact?.FechaInicioPeriodo);
  const fechaHastaIso = normalizeIsoDate(periodoHeader?.FechaHastaFactura || dFact?.FechaFinPeriodo);
  const numeroDiasRaw = parseCnmcNumber(periodoHeader?.NumeroDias);
  const numeroDias = numeroDiasRaw > 0 ? Math.round(numeroDiasRaw) : null;

  // Totales de importes en DatosGeneralesFactura
  const hasRawImporteTotal = dGen?.ImporteTotalFactura !== undefined && dGen?.ImporteTotalFactura !== null;
  const hasRawSaldo = dGen?.SaldoFactura !== undefined && dGen?.SaldoFactura !== null;
  const rawImporteTotal = hasRawImporteTotal ? round2(parseCnmcNumber(dGen.ImporteTotalFactura)) : null;
  const saldoFacturaXml = hasRawSaldo ? round2(parseCnmcNumber(dGen.SaldoFactura)) : null;

  const importeTotalFactura =
    rawImporteTotal !== null ? rawImporteTotal : saldoFacturaXml !== null ? saldoFacturaXml : 0;

  // Desglose de Peajes ATR
  let potenciaEur = parseCnmcNumber(j?.Potencia?.ImporteTotalTerminoPotencia);
  let energiaActivaEur = parseCnmcNumber(j?.EnergiaActiva?.ImporteTotalEnergiaActiva);
  let excesosEur = parseCnmcNumber(j?.ExcesoPotencia?.ImporteTotalExcesos);
  let reactivaEur = parseCnmcNumber(j?.EnergiaReactiva?.ImporteTotalEnergiaReactiva);
  let capacitivaEur = parseCnmcNumber(j?.EnergiaCapacitiva?.ImporteTotalEnergiaCapacitiva);

  const hasAtrSections = Boolean(
    j?.Potencia || j?.EnergiaActiva || j?.ExcesoPotencia || j?.EnergiaReactiva || j?.EnergiaCapacitiva
  );
  let totalPeajes = hasAtrSections
    ? round2(potenciaEur + energiaActivaEur + excesosEur + reactivaEur + capacitivaEur)
    : round2(parseCnmcNumber(dFact?.ImportesFactura?.ImporteTotalPeajes));

  let totalCargos =
    j?.Cargos !== undefined
      ? round2(parseCnmcNumber(j?.Cargos?.TotalImporteCargos))
      : round2(parseCnmcNumber(dFact?.ImportesFactura?.ImporteTotalCargos));

  let alquileresEur = round2(parseCnmcNumber(j?.Alquileres?.ImporteFacturacionAlquileres));
  let impuestoElectricoBase = round2(parseCnmcNumber(j?.ImpuestoElectrico?.BaseImponible));
  const impuestoElectricoPct = parseCnmcNumber(j?.ImpuestoElectrico?.Porcentaje);
  let impuestoElectricoEur = round2(parseCnmcNumber(j?.ImpuestoElectrico?.Importe));

  // Conceptos Repercutibles
  const rawConcList = asArray<any>(j?.ConceptoRepercutible);
  const conceptosRepercutiblesDetalle: F1ConceptoRepercutibleDetail[] = rawConcList.map((c) => {
    const cod = unwrapScalarString(c?.ConceptoRepercutible) || '-';
    return {
      codigo: cod,
      descripcion: CNMC_CONCEPTO_REPERCUTIBLE_LABELS[cod] || `Concepto ${cod}`,
      fechaOperacion: normalizeIsoDate(c?.FechaOperacion),
      unidades: parseCnmcNumber(c?.UnidadesConceptoRepercutible),
      precioUnidad: parseCnmcNumber(c?.PrecioUnidadConceptoRepercutible),
      importeTotal: round2(parseCnmcNumber(c?.ImporteTotalConceptoRepercutible)),
      comentarios: unwrapScalarString(c?.Comentarios),
    };
  });
  let conceptosRepercutiblesEur = round2(
    conceptosRepercutiblesDetalle.reduce((acc, item) => acc + item.importeTotal, 0)
  );

  // Bloques de impuestos (IVA, IVAReducido, IVAIGIC)
  const impuestosDetalle: F1TaxBracketDetail[] = [];
  for (const item of asArray<any>(j?.IVA)) {
    const b = round2(parseCnmcNumber(item?.BaseImponible));
    const p = parseCnmcNumber(item?.Porcentaje);
    const imp = round2(parseCnmcNumber(item?.Importe));
    if (Math.abs(b) > 0 || Math.abs(imp) > 0 || p > 0) {
      impuestosDetalle.push({ tipo: 'IVA', baseImponible: b, porcentaje: p, importe: imp });
    }
  }
  for (const item of asArray<any>(j?.IVAReducido)) {
    const b = round2(parseCnmcNumber(item?.BaseImponible));
    const p = parseCnmcNumber(item?.Porcentaje);
    const imp = round2(parseCnmcNumber(item?.Importe));
    if (Math.abs(b) > 0 || Math.abs(imp) > 0 || p > 0) {
      impuestosDetalle.push({ tipo: 'IVA Reducido / Exento', baseImponible: b, porcentaje: p, importe: imp });
    }
  }
  for (const item of asArray<any>(j?.IVAIGIC)) {
    const b = round2(parseCnmcNumber(item?.BaseImponible));
    const p = parseCnmcNumber(item?.Porcentaje);
    const imp = round2(parseCnmcNumber(item?.Importe));
    if (Math.abs(b) > 0 || Math.abs(imp) > 0 || p > 0) {
      impuestosDetalle.push({ tipo: 'IGIC / IPSI', baseImponible: b, porcentaje: p, importe: imp });
    }
  }

  let ivaEur = round2(impuestosDetalle.reduce((acc, t) => acc + t.importe, 0));
  let baseImponible = round2(impuestosDetalle.reduce((acc, t) => acc + t.baseImponible, 0));

  const componentBase = isOtras
    ? conceptosRepercutiblesEur
    : round2(totalPeajes + totalCargos + alquileresEur + impuestoElectricoEur + conceptosRepercutiblesEur);

  const isCreditType = ['A', 'AR', 'S'].includes(tipoFactura);

  // Caso 1: Facturas Anuladoras (TipoFactura='A') donde la distribuidora envía ImporteTotalFactura negativo
  // pero los desgloses internos (peajes, cargos, alquileres, IVA, energías) vienen en positivo.
  const needsFullComponentSignFlip =
    isCreditType && importeTotalFactura < -0.005 && componentBase > 0.005;

  if (needsFullComponentSignFlip) {
    potenciaEur = -Math.abs(potenciaEur);
    energiaActivaEur = -Math.abs(energiaActivaEur);
    excesosEur = -Math.abs(excesosEur);
    reactivaEur = -Math.abs(reactivaEur);
    capacitivaEur = -Math.abs(capacitivaEur);
    totalPeajes = -Math.abs(totalPeajes);
    totalCargos = -Math.abs(totalCargos);
    alquileresEur = -Math.abs(alquileresEur);
    impuestoElectricoBase = -Math.abs(impuestoElectricoBase);
    impuestoElectricoEur = -Math.abs(impuestoElectricoEur);
    conceptosRepercutiblesEur = -Math.abs(conceptosRepercutiblesEur);
    for (const c of conceptosRepercutiblesDetalle) {
      c.importeTotal = -Math.abs(c.importeTotal);
    }
  }

  if (isCreditType && importeTotalFactura < -0.005 && ivaEur > 0.005) {
    ivaEur = -Math.abs(ivaEur);
    for (const tb of impuestosDetalle) {
      tb.importe = -Math.abs(tb.importe);
    }
  }

  // Caso 2: Fianzas / OtrasFacturas exentas con IVA.BaseImponible = 0 pero ConceptoRepercutible != 0
  const adjustedComponentBase = isOtras
    ? conceptosRepercutiblesEur
    : round2(totalPeajes + totalCargos + alquileresEur + impuestoElectricoEur + conceptosRepercutiblesEur);

  if (Math.abs(baseImponible) < 0.005 && Math.abs(adjustedComponentBase) >= 0.005) {
    baseImponible = adjustedComponentBase;
  } else if (
    baseImponible > 0.005 &&
    (importeTotalFactura < -0.005 || ivaEur < -0.005 || (isCreditType && adjustedComponentBase < -0.005))
  ) {
    // Caso 3: Endesa envía BaseImponible positiva en abonos AR/S donde ImporteTotalFactura e IVA.Importe son negativos
    baseImponible = -Math.abs(baseImponible);
    for (const tb of impuestosDetalle) {
      if (tb.baseImponible > 0) tb.baseImponible = -Math.abs(tb.baseImponible);
    }
  }

  // Fallback legado si la fila no tenía bloques IVA pero sí BaseImponibleF1
  if (Math.abs(baseImponible) < 0.005 && dGen?.BaseImponibleF1 !== undefined) {
    baseImponible = round2(parseCnmcNumber(dGen.BaseImponibleF1));
  }

  // Periodos de Potencia (CNMC expresa potencias en W y precios en €/W/día -> convertimos a kW y €/kW/día)
  const potenciaPeriodos: F1PeriodPowerDetail[] = [];
  for (const tp of asArray<any>(j?.Potencia?.TerminoPotencia)) {
    const fDesde = normalizeIsoDate(tp?.FechaDesde) || fechaDesdeIso;
    const fHasta = normalizeIsoDate(tp?.FechaHasta) || fechaHastaIso;
    asArray<any>(tp?.Periodo).forEach((p, idx) => {
      const potContW = parseCnmcNumber(p?.PotenciaContratada);
      const potFactW = parseCnmcNumber(p?.PotenciaAFacturar);
      const potMaxW = parseCnmcNumber(p?.PotenciaMaxDemandada);
      const precioWDia = parseCnmcNumber(p?.PrecioPotencia);
      if (potContW !== 0 || potFactW !== 0 || precioWDia !== 0) {
        potenciaPeriodos.push({
          periodo: `P${idx + 1}`,
          fechaDesde: fDesde,
          fechaHasta: fHasta,
          potenciaContratadaKw: round2(potContW / 1000),
          potenciaAFacturarKw: round2(potFactW / 1000),
          potenciaMaxDemandadaKw: round2(potMaxW / 1000),
          precioKwDia: Math.round(precioWDia * 1000 * 1e6) / 1e6,
        });
      }
    });
  }

  // Periodos de Energía Activa (Regla 201: TerminoEnergiaActiva puede ser objeto o array de subperiodos)
  const energiaPeriodos: F1PeriodEnergyDetail[] = [];
  let totalEnergiaKwh = 0;
  for (const tea of asArray<any>(j?.EnergiaActiva?.TerminoEnergiaActiva)) {
    const fDesde = normalizeIsoDate(tea?.FechaDesde) || fechaDesdeIso;
    const fHasta = normalizeIsoDate(tea?.FechaHasta) || fechaHastaIso;
    asArray<any>(tea?.Periodo).forEach((p, idx) => {
      let kwh = parseCnmcNumber(p?.ValorEnergiaActiva);
      if (needsFullComponentSignFlip && kwh > 0) {
        kwh = -kwh;
      }
      const precio = parseCnmcNumber(p?.PrecioEnergia);
      totalEnergiaKwh += kwh;
      if (kwh !== 0 || precio !== 0) {
        energiaPeriodos.push({
          periodo: `P${idx + 1}`,
          fechaDesde: fDesde,
          fechaHasta: fHasta,
          energiaKwh: Math.round(kwh * 1000) / 1000,
          precioKwh: precio,
        });
      }
    });
  }
  totalEnergiaKwh = Math.round(totalEnergiaKwh * 1000) / 1000;

  // Excedentes de autoconsumo (si existen en bloque Autoconsumo)
  let totalExcedentesKwh = 0;
  for (const neta of asArray<any>(j?.Autoconsumo?.EnergiaExcedentaria || j?.Autoconsumo?.TerminoEnergiaExcedentaria)) {
    for (const p of asArray<any>(neta?.Periodo || neta)) {
      totalExcedentesKwh += parseCnmcNumber(p?.ValorEnergiaExcedentaria);
    }
  }
  totalExcedentesKwh = Math.round(totalExcedentesKwh * 1000) / 1000;

  // Desglose de Cargos (TipoCargo 1 = Potencia, 2 = Energía)
  const cargosDetalle: F1CargoBlockDetail[] = [];
  for (const c of asArray<any>(j?.Cargos?.Cargo)) {
    const tc = unwrapScalarString(c?.TipoCargo) || '';
    const tcTerm = Array.isArray(c?.TerminoCargo) ? c.TerminoCargo[0] : c?.TerminoCargo;
    let imp = round2(parseCnmcNumber(c?.TotalImporteTipoCargo));
    if (needsFullComponentSignFlip && imp > 0) imp = -Math.abs(imp);
    cargosDetalle.push({
      tipoCargo: tc,
      etiqueta: tc === '1' || tc === '01' ? 'Cargos de Potencia' : tc === '2' || tc === '02' ? 'Cargos de Energía' : `Cargos (${tc})`,
      fechaDesde: normalizeIsoDate(tcTerm?.FechaDesde) || fechaDesdeIso,
      fechaHasta: normalizeIsoDate(tcTerm?.FechaHasta) || fechaHastaIso,
      importeTotal: imp,
    });
  }

  const hasDistinctSaldo =
    saldoFacturaXml !== null && Math.abs(saldoFacturaXml - importeTotalFactura) >= 0.01;

  return {
    tipoDocumento,
    tipoFactura,
    tipoFacturaLabel,
    motivoFacturacion,
    motivoFacturacionLabel,
    codigoFiscal,
    codigoRectificada,
    codigoAbono,
    cups,
    tarifaAtrCode,
    tarifaAtrLabel,
    identificadorEmisora,
    fechaFacturaIso,
    fechaDesdeIso,
    fechaHastaIso,
    numeroDias,
    totalEnergiaKwh,
    totalExcedentesKwh,
    potenciaEur: round2(potenciaEur),
    energiaActivaEur: round2(energiaActivaEur),
    excesosEur: round2(excesosEur),
    reactivaEur: round2(reactivaEur),
    capacitivaEur: round2(capacitivaEur),
    totalPeajes: round2(totalPeajes),
    totalCargos: round2(totalCargos),
    alquileresEur: round2(alquileresEur),
    impuestoElectricoBase: round2(impuestoElectricoBase),
    impuestoElectricoPct,
    impuestoElectricoEur: round2(impuestoElectricoEur),
    conceptosRepercutiblesEur: round2(conceptosRepercutiblesEur),
    baseImponible: round2(baseImponible),
    ivaEur: round2(ivaEur),
    importeTotalFactura: round2(importeTotalFactura),
    saldoFacturaXml,
    hasDistinctSaldo,
    comentarios,
    potenciaPeriodos,
    energiaPeriodos,
    cargosDetalle,
    impuestosDetalle,
    conceptosRepercutiblesDetalle,
  };
}

const INVERTIBLE_EXACT_KEYS = new Set([
  'ConsumoCalculado',
  'consumoCalculado',
  'ValorEnergiaActiva',
  'valorEnergiaActiva',
  'ValorEnergiaReactiva',
  'valorEnergiaReactiva',
  'ValorEnergiaCapacitiva',
  'ValorEnergiaExcedentaria',
  'valorEnergiaExcedentaria',
  'Importe',
  'importe',
  'ImporteTotalFactura',
  'SaldoFactura',
  'BaseImponible',
  'BaseImponibleF1',
  'ImporteTotalTerminoPotencia',
  'ImporteTotalEnergiaActiva',
  'ImporteTotalExcesos',
  'ImporteTotalEnergiaReactiva',
  'ImporteTotalEnergiaCapacitiva',
  'ImporteTotalPeajes',
  'ImporteTotalCargos',
  'TotalImporteCargos',
  'TotalImporteTipoCargo',
  'ImporteFacturacionAlquileres',
  'ImporteAlquiler',
  'ImportePenalizacion',
  'ImporteTotalConceptoRepercutible',
  'UnidadesConceptoRepercutible',
]);

/**
 * Invierte de forma segura los signos de consumos e importes monetarios al generar un abono sintético AR
 * a partir de la factura N original, sin alterar precios unitarios, porcentajes ni lecturas de contador.
 */
export function invertF1JsonForSyntheticAbono(sourceJson: any): any {
  const cloned = JSON.parse(JSON.stringify(sourceJson || {}));

  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (val && typeof val === 'object') {
        walk(val);
      } else if ((typeof val === 'number' || typeof val === 'string') && INVERTIBLE_EXACT_KEYS.has(key)) {
        const parsed = parseCnmcNumber(val);
        if (parsed !== 0) {
          if (typeof val === 'number') {
            node[key] = -parsed;
          } else {
            node[key] = (-parsed).toString().replace('.', ',');
          }
        }
      }
    }
  };

  walk(cloned);
  return cloned;
}
