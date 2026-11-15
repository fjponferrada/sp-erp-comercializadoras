import * as xlsx from 'xlsx';

export function parseSpanishExportNum(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val === null || val === undefined || val === '') return 0;
  let s = String(val).trim();
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const parsed = parseFloat(s);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatDateES_UTC(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export const OFFICIAL_INVOICE_EXPORT_HEADERS: string[] = [
  'Numero Factura',
  'Contrato',
  'Numero factura rectificada',
  'NOMBRE/RAZON SOCIAL',
  'CIF',
  'CUPS',
  'Tipo Factura',
  'Fecha Factura',
  'Procedencia Desde',
  'Procedencia Hasta',
  'Desde',
  'Hasta',
  'Dias',
  'P1C',
  'P2C',
  'P3C',
  'P4C',
  'P5C',
  'P6C',
  'P1 Potencia Max Demanda',
  'P2 Potencia Max Demanda',
  'P3 Potencia Max Demanda',
  'P4 Potencia Max Demanda',
  'P5 Potencia Max Demanda',
  'P6 Potencia Max Demanda',
  'P1 Energia Activa Consumida',
  'P2 Energia Activa Consumida',
  'P3 Energia Activa Consumida',
  'P4 Energia Activa Consumida',
  'P5 Energia Activa Consumida',
  'P6 Energia Activa Consumida',
  'Energía Total Consumida',
  'P1 Energia Reactiva Consumida',
  'P2 Energia Reactiva Consumida',
  'P3 Energia Reactiva Consumida',
  'P4 Energia Reactiva Consumida',
  'P5 Energia Reactiva Consumida',
  'P6 Energia Reactiva Consumida',
  'Reactiva Total Consumida',
  'Importe Ponderado ATR Potencia P1',
  'Importe Ponderado ATR Potencia P2',
  'Importe Ponderado ATR Potencia P3',
  'Importe Ponderado ATR Potencia P4',
  'Importe Ponderado ATR Potencia P5',
  'Importe Ponderado ATR Potencia P6',
  'Importe Ponderado ATR Energia P1',
  'Importe Ponderado ATR Energia P2',
  'Importe Ponderado ATR Energia P3',
  'Importe Ponderado ATR Energia P4',
  'Importe Ponderado ATR Energia P5',
  'Importe Ponderado ATR Energia P6',
  'Importe Potencia Factura',
  'Importe Energia Factura',
  'Importe Total R ATR',
  'Importe Ajuste Gas',
  'Importe Total Excesos ATR',
  'Importe Impuesto',
  'Importe Bono Social',
  'Alquiler Equipo de Medida',
  'Subtotal 2',
  'Subtotal Otros Concepto',
  'Base Imponible 0',
  'Base Imponible 21',
  'Importe IVA',
  'Total',
];

export function buildOfficialInvoiceExportRow(inv: any): any[] {
  const d: any = inv.invoiceData || {};
  const clientObj = inv.client || inv.contract?.client;
  const spObj = inv.supplyPoint || inv.contract?.supplyPoint;

  const clientName =
    clientObj?.businessName ||
    (clientObj
      ? [clientObj.firstName, clientObj.lastName, clientObj.lastName2].filter(Boolean).join(' ')
      : '') ||
    d['NOMBRE/RAZON SOCIAL'] ||
    '';
  const cif = clientObj?.vatNumber || d['CIF'] || d['NIF/CIF'] || '';

  const procHasta =
    d['Procedencia Hasta'] ||
    (inv.origin && inv.origin !== 'INTERNAL_ENGINE' ? inv.origin : '') ||
    '';

  const normalizedType =
    String(inv.invoiceType || d['Tipo Factura'] || 'Normal').trim() === 'Rectificadora'
      ? 'Rectificativa'
      : inv.invoiceType || d['Tipo Factura'] || 'Normal';

  const row: any[] = [
    inv.invoiceNumber || d['Numero Factura'] || '',
    inv.contract?.contractCode || d['CONTRATO'] || d['Contrato'] || '',
    d['Numero factura rectificada'] || '',
    clientName,
    cif,
    spObj?.cups || d['CUPS'] || '',
    normalizedType,
    d['Fecha Factura'] || formatDateES_UTC(inv.issueDate),
    d['Procedencia Desde'] || '',
    procHasta,
    d['Desde'] || formatDateES_UTC(inv.billingStart) || '',
    d['Hasta'] || formatDateES_UTC(inv.billingEnd) || '',
    parseSpanishExportNum(d['Dias'] ?? d['Dias CORR'] ?? d['Numero Dias Alquiler 1'] ?? 0),
    parseSpanishExportNum(d['P1 Potencia Contratada'] ?? d['P1C'] ?? inv.contract?.p1c),
    parseSpanishExportNum(d['P2 Potencia Contratada'] ?? d['P2C'] ?? inv.contract?.p2c),
    parseSpanishExportNum(d['P3 Potencia Contratada'] ?? d['P3C'] ?? inv.contract?.p3c),
    parseSpanishExportNum(d['P4 Potencia Contratada'] ?? d['P4C'] ?? inv.contract?.p4c),
    parseSpanishExportNum(d['P5 Potencia Contratada'] ?? d['P5C'] ?? inv.contract?.p5c),
    parseSpanishExportNum(d['P6 Potencia Contratada'] ?? d['P6C'] ?? inv.contract?.p6c),
    parseSpanishExportNum(d['P1 Potencia Max Demanda']),
    parseSpanishExportNum(d['P2 Potencia Max Demanda']),
    parseSpanishExportNum(d['P3 Potencia Max Demanda']),
    parseSpanishExportNum(d['P4 Potencia Max Demanda']),
    parseSpanishExportNum(d['P5 Potencia Max Demanda']),
    parseSpanishExportNum(d['P6 Potencia Max Demanda']),
    parseSpanishExportNum(d['P1 Energia Activa Consumida']),
    parseSpanishExportNum(d['P2 Energia Activa Consumida']),
    parseSpanishExportNum(d['P3 Energia Activa Consumida']),
    parseSpanishExportNum(d['P4 Energia Activa Consumida']),
    parseSpanishExportNum(d['P5 Energia Activa Consumida']),
    parseSpanishExportNum(d['P6 Energia Activa Consumida']),
    parseSpanishExportNum(d['Energía Total Consumida'] ?? inv.totalMWh),
    parseSpanishExportNum(d['P1 Energia Reactiva Consumida']),
    parseSpanishExportNum(d['P2 Energia Reactiva Consumida']),
    parseSpanishExportNum(d['P3 Energia Reactiva Consumida']),
    parseSpanishExportNum(d['P4 Energia Reactiva Consumida']),
    parseSpanishExportNum(d['P5 Energia Reactiva Consumida']),
    parseSpanishExportNum(d['P6 Energia Reactiva Consumida']),
    parseSpanishExportNum(d['Reactiva Total Consumida']),
    parseSpanishExportNum(d['Importe Ponderado ATR Potencia P1']),
    parseSpanishExportNum(d['Importe Ponderado ATR Potencia P2']),
    parseSpanishExportNum(d['Importe Ponderado ATR Potencia P3']),
    parseSpanishExportNum(d['Importe Ponderado ATR Potencia P4']),
    parseSpanishExportNum(d['Importe Ponderado ATR Potencia P5']),
    parseSpanishExportNum(d['Importe Ponderado ATR Potencia P6']),
    parseSpanishExportNum(d['Importe Ponderado ATR Energia P1']),
    parseSpanishExportNum(d['Importe Ponderado ATR Energia P2']),
    parseSpanishExportNum(d['Importe Ponderado ATR Energia P3']),
    parseSpanishExportNum(d['Importe Ponderado ATR Energia P4']),
    parseSpanishExportNum(d['Importe Ponderado ATR Energia P5']),
    parseSpanishExportNum(d['Importe Ponderado ATR Energia P6']),
    parseSpanishExportNum(d['Importe Potencia Factura']),
    parseSpanishExportNum(d['Importe Energia Factura']),
    parseSpanishExportNum(d['Importe Total R ATR']),
    parseSpanishExportNum(d['Importe Ajuste Gas']),
    parseSpanishExportNum(d['Importe Total Excesos ATR']),
    parseSpanishExportNum(d['Importe Impuesto CORR'] ?? d['Importe Impuesto'] ?? inv.taxAmount),
    parseSpanishExportNum(d['Importe Bono Social CORR'] ?? d['Importe Bono Social']),
    parseSpanishExportNum(d['Alquiler Equipo de Medida']),
    parseSpanishExportNum(d['Subtotal 2']),
    parseSpanishExportNum(d['Subtotal Otros Concepto']),
    parseSpanishExportNum(d['Base Imponible 0']),
    parseSpanishExportNum(d['Base Imponible 21'] ?? d['Base Imponible IVA']),
    parseSpanishExportNum(d['Importe IVA']),
    inv.totalAmount ?? parseSpanishExportNum(d['Total']),
  ];

  // Regla 113: Invertir valores para facturas de Abono desde la columna M ("Dias", índice 12) en adelante
  if (String(normalizedType).toLowerCase().includes('abono')) {
    for (let i = 12; i < row.length; i++) {
      if (typeof row[i] === 'number' && row[i] !== 0) {
        row[i] = -Math.abs(row[i] as number);
      }
    }
  }

  return row;
}

export function buildOfficialInvoicesExcelBuffer(
  invoices: any[],
  sheetName = 'Facturas'
): Buffer {
  const rows = invoices.map((inv) => buildOfficialInvoiceExportRow(inv));
  const worksheet = xlsx.utils.aoa_to_sheet([OFFICIAL_INVOICE_EXPORT_HEADERS, ...rows]);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
