export const INGEBAU_CONSUMOS_HEADERS = [
  'CUPS',
  'Lectura Desde',
  'Lectura Hasta',
  'Tipo Lectura',
  'Tarifa ATR',
  'Energia Activa P1 (kWh)',
  'Energia Activa P2 (kWh)',
  'Energia Activa P3 (kWh)',
  'Energia Activa P4 (kWh)',
  'Energia Activa P5 (kWh)',
  'Energia Activa P6 (kWh)',
  'Maxímetro P1 (kW)',
  'Maxímetro P2 (kW)',
  'Maxímetro P3 (kW)',
  'Maxímetro P4 (kW)',
  'Maxímetro P5 (kW)',
  'Maxímetro P6 (kW)',
  'Energía Reactiva P1 (Varh)',
  'Energía Reactiva P2 (Varh)',
  'Energía Reactiva P3 (Varh)',
  'Energía Reactiva P4 (Varh)',
  'Energía Reactiva P5 (Varh)',
  'Energía Reactiva P6 (Varh)',
] as const;

export const INGEBAU_PS_HEADERS = [
  'Codigo Distribuidora',
  'Nombre Distribuidora',
  'CUPS',
  'Código Postal PS',
  'Municipio PS',
  'Fecha Alta PS',
  'Tarifa ATR',
  'Tension',
  'Potencia Max BIE (kW)',
  'Tipo PM',
  'Consumo Anual kWh',
  'Consumo Anual P1 kWh',
  'Consumo Anual P2 kWh',
  'Consumo Anual P3 kWh',
  'Consumo Anual P4 kWh',
  'Consumo Anual P5 kWh',
  'Consumo Anual P6 kWh',
  'Consumo Anual Anterior',
  'Potencia Contratada P1 kW',
  'Potencia Contratada P2 kW',
  'Potencia Contratada P3 kW',
  'Potencia Contratada P4 kW',
  'Potencia Contratada P5 kW',
  'Potencia Contratada P6 kW',
  'valorDerechosExtensionkW',
  'valorDerechosAccesokW',
  'Propietario EM',
  'fechaUltimoMovimientoContrato',
  'fechaUltimoCambioComercializador',
  'fechaLimiteDerechosReconocidos',
  'fechaUltimaLectura',
  'codigoTelegestion',
  'codigoAutoconsumo',
  'CNAE',
  'codigoModoControlPotencia',
  'aplicacionBonoSocial',
] as const;

function csvQuote(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function mapReadingCodeToIngebauLabel(code: unknown, existingLabel?: unknown): string {
  if (existingLabel && typeof existingLabel === 'string' && existingLabel.trim()) {
    return existingLabel.trim();
  }
  const clean = String(code ?? '').trim();
  if (clean === '60') return 'Telegestión';
  if (clean === '10' || clean === '30' || clean === '50') return 'Real';
  if (clean === '20' || clean === '40' || clean === '70' || clean === '99') return 'Estimada';
  return clean || 'Telegestión';
}

/**
 * Genera el CSV de consumos ({CUPS}_consumos.csv) con las 23 columnas exactas
 * de Ingebau, 100% compatible con el importador "SIPS CSV" de /pricing.
 */
export function buildIngebauConsumosCsv(sipsPayload: any): string {
  const raw = sipsPayload?.data ? sipsPayload.data : sipsPayload;
  const consumos: any[] = Array.isArray(raw?.consumos) ? raw.consumos : [];

  const lines: string[] = [INGEBAU_CONSUMOS_HEADERS.map(csvQuote).join(',')];

  for (const row of consumos) {
    const tipoLectura = mapReadingCodeToIngebauLabel(row?.codigoTipoLectura, row?.TipoLectura);
    const values = [
      row?.CUPS ?? '',
      row?.LecturaDesde ?? '',
      row?.LecturaHasta ?? '',
      tipoLectura,
      row?.TarifaATR ?? '',
      row?.['EnergiaActivaP1(kWh)'] ?? 0,
      row?.['EnergiaActivaP2(kWh)'] ?? 0,
      row?.['EnergiaActivaP3(kWh)'] ?? 0,
      row?.['EnergiaActivaP4(kWh)'] ?? 0,
      row?.['EnergiaActivaP5(kWh)'] ?? 0,
      row?.['EnergiaActivaP6(kWh)'] ?? 0,
      row?.['MaxímetroP1(kW)'] ?? 0,
      row?.['MaxímetroP2(kW)'] ?? 0,
      row?.['MaxímetroP3(kW)'] ?? 0,
      row?.['MaxímetroP4(kW)'] ?? 0,
      row?.['MaxímetroP5(kW)'] ?? 0,
      row?.['MaxímetroP6(kW)'] ?? 0,
      row?.['EnergíaReactivaP1(Varh)'] ?? 0,
      row?.['EnergíaReactivaP2(Varh)'] ?? 0,
      row?.['EnergíaReactivaP3(Varh)'] ?? 0,
      row?.['EnergíaReactivaP4(Varh)'] ?? 0,
      row?.['EnergíaReactivaP5(Varh)'] ?? 0,
      row?.['EnergíaReactivaP6(Varh)'] ?? 0,
    ];
    lines.push(values.map(csvQuote).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Genera el CSV maestro del Punto de Suministro ({CUPS}_ps.csv) con las 36 columnas
 * exactas de Ingebau.
 */
export function buildIngebauPsCsv(sipsPayload: any): string {
  const raw = sipsPayload?.data ? sipsPayload.data : sipsPayload;
  const ps: any = Array.isArray(raw?.ps) ? raw.ps[0] : raw?.ps || raw || {};

  const headerLine = INGEBAU_PS_HEADERS.map(csvQuote).join(',');
  const values = [
    ps?.['CódigoDistribuidora'] ?? '',
    ps?.NombreDistribuidora ?? '',
    ps?.CUPS ?? '',
    ps?.['CódigoPostalPS'] ?? '',
    ps?.MunicipioPS ?? '',
    ps?.FechaAltaPS ?? '',
    ps?.TarifaATR ?? '',
    ps?.Tension ?? '',
    ps?.['PotenciaMaxBIE(kW)'] ?? '',
    ps?.TipoPM ?? '',
    ps?.ConsumoAnualkWh ?? 0,
    ps?.ConsumoAnualP1kWh ?? 0,
    ps?.ConsumoAnualP2kWh ?? 0,
    ps?.ConsumoAnualP3kWh ?? 0,
    ps?.ConsumoAnualP4kWh ?? 0,
    ps?.ConsumoAnualP5kWh ?? 0,
    ps?.ConsumoAnualP6kWh ?? 0,
    ps?.ConsumoAnualAnterior ?? 0,
    ps?.PotenciaContratadaP1kW ?? 0,
    ps?.PotenciaContratadaP2kW ?? 0,
    ps?.PotenciaContratadaP3kW ?? 0,
    ps?.PotenciaContratadaP4kW ?? 0,
    ps?.PotenciaContratadaP5kW ?? 0,
    ps?.PotenciaContratadaP6kW ?? 0,
    ps?.valorDerechosExtensionkW ?? '',
    ps?.valorDerechosAccesokW ?? '',
    ps?.['Propietario EM'] ?? '',
    ps?.fechaUltimoMovimientoContrato ?? '',
    ps?.fechaUltimoCambioComercializador ?? '',
    ps?.fechaLimiteDerechosReconocidos ?? '',
    ps?.fechaUltimaLectura ?? '',
    ps?.codigoTelegestion ?? '',
    ps?.codigoAutoconsumo ?? '0',
    ps?.CNAE ?? '',
    ps?.codigoModoControlPotencia ?? '',
    ps?.aplicacionBonoSocial ?? '0',
  ];

  return `${headerLine}\r\n${values.map(csvQuote).join(',')}`;
}

/**
 * Descarga un string CSV en el navegador del cliente.
 */
export function triggerBrowserCsvDownload(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
