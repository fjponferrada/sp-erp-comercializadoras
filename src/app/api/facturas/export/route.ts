import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import { buildInvoiceListWhereClause } from '@/app/actions/invoiceActions';
import * as xlsx from 'xlsx';
import { auth } from '@/auth';

function parseSpanishNum(val: any): number {
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

function formatDateES_UTC(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

async function generateExportResponse(params: {
  searchTerm?: string;
  filterType?: string;
  status?: string;
  pdfFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  invoiceIds?: string[];
}) {
  const visibilityFilter = await getInvoiceVisibilityFilter();
  const whereClause = await buildInvoiceListWhereClause({
    visibilityFilter,
    searchTerm: params.searchTerm,
    filterType: params.filterType,
    communicationFilter: params.status,
    pdfFilter: params.pdfFilter,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    selectedIds: params.invoiceIds,
  });

  const invoicesRaw = await prisma.invoice.findMany({
    where: whereClause,
    include: { client: true, contract: true, supplyPoint: true },
    orderBy: [{ issueDate: 'desc' }, { invoiceNumber: 'desc' }],
  });

  const rows = invoicesRaw.map((inv) => {
    const d: any = inv.invoiceData || {};
    const clientName =
      inv.client?.businessName ||
      (inv.client
        ? [inv.client.firstName, inv.client.lastName, inv.client.lastName2].filter(Boolean).join(' ')
        : '') ||
      d['NOMBRE/RAZON SOCIAL'] ||
      '';
    const cif = inv.client?.vatNumber || d['CIF'] || d['NIF/CIF'] || '';

    const row = [
      inv.invoiceNumber,
      inv.contract?.contractCode || d['CONTRATO'] || d['Contrato'] || '',
      d['Numero factura rectificada'] || '',
      clientName,
      cif,
      inv.supplyPoint?.cups || d['CUPS'] || '',
      inv.invoiceType || 'Normal',
      formatDateES_UTC(inv.issueDate),
      d['Procedencia Desde'] || '',
      d['Procedencia Hasta'] || inv.origin || '',
      formatDateES_UTC(inv.billingStart) || d['Desde'] || '',
      formatDateES_UTC(inv.billingEnd) || d['Hasta'] || '',
      parseSpanishNum(d['Dias'] ?? d['Dias CORR'] ?? d['Numero Dias Alquiler 1'] ?? 0),
      parseSpanishNum(d['P1 Potencia Contratada'] ?? d['P1C'] ?? inv.contract?.p1c),
      parseSpanishNum(d['P2 Potencia Contratada'] ?? d['P2C'] ?? inv.contract?.p2c),
      parseSpanishNum(d['P3 Potencia Contratada'] ?? d['P3C'] ?? inv.contract?.p3c),
      parseSpanishNum(d['P4 Potencia Contratada'] ?? d['P4C'] ?? inv.contract?.p4c),
      parseSpanishNum(d['P5 Potencia Contratada'] ?? d['P5C'] ?? inv.contract?.p5c),
      parseSpanishNum(d['P6 Potencia Contratada'] ?? d['P6C'] ?? inv.contract?.p6c),
      parseSpanishNum(d['P1 Potencia Max Demanda']),
      parseSpanishNum(d['P2 Potencia Max Demanda']),
      parseSpanishNum(d['P3 Potencia Max Demanda']),
      parseSpanishNum(d['P4 Potencia Max Demanda']),
      parseSpanishNum(d['P5 Potencia Max Demanda']),
      parseSpanishNum(d['P6 Potencia Max Demanda']),
      parseSpanishNum(d['P1 Energia Activa Consumida']),
      parseSpanishNum(d['P2 Energia Activa Consumida']),
      parseSpanishNum(d['P3 Energia Activa Consumida']),
      parseSpanishNum(d['P4 Energia Activa Consumida']),
      parseSpanishNum(d['P5 Energia Activa Consumida']),
      parseSpanishNum(d['P6 Energia Activa Consumida']),
      parseSpanishNum(d['Energía Total Consumida'] ?? inv.totalMWh),
      parseSpanishNum(d['P1 Energia Reactiva Consumida']),
      parseSpanishNum(d['P2 Energia Reactiva Consumida']),
      parseSpanishNum(d['P3 Energia Reactiva Consumida']),
      parseSpanishNum(d['P4 Energia Reactiva Consumida']),
      parseSpanishNum(d['P5 Energia Reactiva Consumida']),
      parseSpanishNum(d['P6 Energia Reactiva Consumida']),
      parseSpanishNum(d['Reactiva Total Consumida']),
      parseSpanishNum(d['Importe Ponderado ATR Potencia P1']),
      parseSpanishNum(d['Importe Ponderado ATR Potencia P2']),
      parseSpanishNum(d['Importe Ponderado ATR Potencia P3']),
      parseSpanishNum(d['Importe Ponderado ATR Potencia P4']),
      parseSpanishNum(d['Importe Ponderado ATR Potencia P5']),
      parseSpanishNum(d['Importe Ponderado ATR Potencia P6']),
      parseSpanishNum(d['Importe Ponderado ATR Energia P1']),
      parseSpanishNum(d['Importe Ponderado ATR Energia P2']),
      parseSpanishNum(d['Importe Ponderado ATR Energia P3']),
      parseSpanishNum(d['Importe Ponderado ATR Energia P4']),
      parseSpanishNum(d['Importe Ponderado ATR Energia P5']),
      parseSpanishNum(d['Importe Ponderado ATR Energia P6']),
      parseSpanishNum(d['Importe Potencia Factura']),
      parseSpanishNum(d['Importe Energia Factura']),
      parseSpanishNum(d['Importe Total R ATR']),
      parseSpanishNum(d['Importe Ajuste Gas']),
      parseSpanishNum(d['Importe Total Excesos ATR']),
      parseSpanishNum(d['Importe Impuesto CORR'] ?? d['Importe Impuesto'] ?? inv.taxAmount),
      parseSpanishNum(d['Importe Bono Social CORR'] ?? d['Importe Bono Social']),
      parseSpanishNum(d['Alquiler Equipo de Medida']),
      parseSpanishNum(d['Subtotal 2']),
      parseSpanishNum(d['Subtotal Otros Concepto']),
      parseSpanishNum(d['Base Imponible 0']),
      parseSpanishNum(d['Base Imponible 21'] ?? d['Base Imponible IVA']),
      parseSpanishNum(d['Importe IVA']),
      inv.totalAmount ?? parseSpanishNum(d['Total']),
    ];

    // Regla 113: Invertir valores para facturas de Abono desde la columna M ("Dias", índice 12) en adelante
    if (inv.invoiceType?.toLowerCase().includes('abono')) {
      for (let i = 12; i < row.length; i++) {
        if (typeof row[i] === 'number' && row[i] !== 0) {
          row[i] = -Math.abs(row[i] as number);
        }
      }
    }

    return row;
  });

  const headers = [
    'Numero Factura', 'Contrato', 'Numero factura rectificada', 'NOMBRE/RAZON SOCIAL',
    'CIF', 'CUPS', 'Tipo Factura', 'Fecha Factura', 'Procedencia Desde', 'Procedencia Hasta',
    'Desde', 'Hasta', 'Dias', 'P1C', 'P2C', 'P3C', 'P4C', 'P5C', 'P6C',
    'P1 Potencia Max Demanda', 'P2 Potencia Max Demanda', 'P3 Potencia Max Demanda',
    'P4 Potencia Max Demanda', 'P5 Potencia Max Demanda', 'P6 Potencia Max Demanda',
    'P1 Energia Activa Consumida', 'P2 Energia Activa Consumida', 'P3 Energia Activa Consumida',
    'P4 Energia Activa Consumida', 'P5 Energia Activa Consumida', 'P6 Energia Activa Consumida',
    'Energía Total Consumida', 'P1 Energia Reactiva Consumida', 'P2 Energia Reactiva Consumida',
    'P3 Energia Reactiva Consumida', 'P4 Energia Reactiva Consumida', 'P5 Energia Reactiva Consumida',
    'P6 Energia Reactiva Consumida', 'Reactiva Total Consumida', 'Importe Ponderado ATR Potencia P1',
    'Importe Ponderado ATR Potencia P2', 'Importe Ponderado ATR Potencia P3', 'Importe Ponderado ATR Potencia P4',
    'Importe Ponderado ATR Potencia P5', 'Importe Ponderado ATR Potencia P6', 'Importe Ponderado ATR Energia P1',
    'Importe Ponderado ATR Energia P2', 'Importe Ponderado ATR Energia P3', 'Importe Ponderado ATR Energia P4',
    'Importe Ponderado ATR Energia P5', 'Importe Ponderado ATR Energia P6', 'Importe Potencia Factura',
    'Importe Energia Factura', 'Importe Total R ATR', 'Importe Ajuste Gas', 'Importe Total Excesos ATR',
    'Importe Impuesto', 'Importe Bono Social', 'Alquiler Equipo de Medida', 'Subtotal 2',
    'Subtotal Otros Concepto', 'Base Imponible 0', 'Base Imponible 21', 'Importe IVA', 'Total',
  ];

  const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Facturas');

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="export_facturas.xlsx"',
    },
  });
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    return await generateExportResponse({
      searchTerm: searchParams.get('search') || '',
      filterType: searchParams.get('type') || '',
      status: searchParams.get('status') || '',
      pdfFilter: searchParams.get('pdfFilter') || '',
      dateFrom: searchParams.get('from') || '',
      dateTo: searchParams.get('to') || '',
      invoiceIds: idsParam ? idsParam.split(',').filter(Boolean) : undefined,
    });
  } catch (error) {
    console.error('Export GET error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    return await generateExportResponse({
      searchTerm: body.search || '',
      filterType: body.type || '',
      status: body.status || '',
      pdfFilter: body.pdfFilter || '',
      dateFrom: body.from || '',
      dateTo: body.to || '',
      invoiceIds: Array.isArray(body.invoiceIds) && body.invoiceIds.length > 0 ? body.invoiceIds : undefined,
    });
  } catch (error) {
    console.error('Export POST error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
