import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { toZonedTime } from 'date-fns-tz';
import { MADRID_TZ, round2 } from '@/lib/bajasServer';
import { queryPenaltyInvoicesDataset } from '@/lib/penaltyInvoicesServer';

function formatDateESMadrid(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const z = toZonedTime(d, MADRID_TZ);
  const day = String(z.getDate()).padStart(2, '0');
  const month = String(z.getMonth() + 1).padStart(2, '0');
  const year = z.getFullYear();
  return `${day}/${month}/${year}`;
}

async function generateExportResponse(params: {
  searchTerm?: string;
  statusFilter?: string;
  paymentFilter?: string;
  typeFilter?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  selectedIds?: string[];
}) {
  const dataset = await queryPenaltyInvoicesDataset({
    ...params,
    exportAll: true,
  });

  const headers = [
    'Nº Factura',
    'Tipo Documento',
    'Factura Rectificada',
    'Fecha Emisión',
    'Contrato',
    'Titular / Razón Social',
    'NIF / CIF',
    'Email Facturación',
    'CUPS',
    'Tarifa ATR',
    'Producto',
    'Marca',
    'Base Imponible (€)',
    'IVA 21% (€)',
    'Total con IVA (€)',
    'Estado Comunicación',
    'Fecha Comunicación',
    'Estado Cobro',
    'Fecha Cobro',
  ];

  const rows = dataset.invoices.map((inv: any) => {
    const isAbono = inv.invoiceType === 'ABONO';
    const rawTotal = Math.abs(Number(inv.amount || 0));
    const rawBase =
      inv.baseAmount !== null && inv.baseAmount !== undefined
        ? Math.abs(Number(inv.baseAmount))
        : round2(rawTotal / 1.21);
    const rawTax =
      inv.taxAmount !== null && inv.taxAmount !== undefined
        ? Math.abs(Number(inv.taxAmount))
        : round2(rawTotal - rawBase);

    const sign = isAbono ? -1 : 1;

    return [
      inv.invoiceNumber,
      isAbono ? 'ABONO' : 'PENALIZACION',
      inv.rectifiedPenalty?.invoiceNumber || '',
      formatDateESMadrid(inv.issueDate),
      inv.contract?.contractCode || '',
      inv.client?.businessName ||
        `${inv.client?.firstName || ''} ${inv.client?.lastName || ''}`.trim(),
      inv.client?.vatNumber || '',
      inv.client?.invoiceEmail || inv.client?.contactEmail || '',
      inv.supplyPoint?.cups || '',
      inv.supplyPoint?.tariff || '',
      inv.contract?.product?.name || '',
      inv.contract?.brand?.name || '',
      round2(sign * rawBase),
      round2(sign * rawTax),
      round2(sign * rawTotal),
      inv.status || 'EMITIDA',
      formatDateESMadrid(inv.communicatedAt),
      inv.paymentStatus || 'PENDIENTE',
      formatDateESMadrid(inv.paymentDate),
    ];
  });

  const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Penalizaciones');

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="facturas_penalizaciones.xlsx"',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return await generateExportResponse({
      searchTerm: body.searchTerm || '',
      statusFilter: body.statusFilter || 'TODOS',
      paymentFilter: body.paymentFilter || 'TODOS',
      typeFilter: body.typeFilter || 'TODOS',
      dateFrom: body.dateFrom || null,
      dateTo: body.dateTo || null,
      selectedIds:
        Array.isArray(body.invoiceIds) && body.invoiceIds.length > 0
          ? body.invoiceIds
          : undefined,
    });
  } catch (error: any) {
    console.error('Error exporting penalty invoices XLSX:', error);
    const status = String(error?.message || '').includes('permisos') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    return await generateExportResponse({
      searchTerm: searchParams.get('search') || '',
      statusFilter: searchParams.get('status') || 'TODOS',
      paymentFilter: searchParams.get('payment') || 'TODOS',
      typeFilter: searchParams.get('type') || 'TODOS',
      dateFrom: searchParams.get('from') || null,
      dateTo: searchParams.get('to') || null,
    });
  } catch (error: any) {
    console.error('Error exporting penalty invoices GET:', error);
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
  }
}
