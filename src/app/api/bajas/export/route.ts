import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { BajasTabMode, queryBajasDataset } from '@/lib/bajasServer';

async function buildBajasWorkbookResponse(params: {
  tab?: BajasTabMode;
  search?: string;
  canalFilter?: string;
  origenBajaFilter?: string[];
  tarifaFilter?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  penaltyFilter?: string;
  winbackFilter?: string;
  selectedIds?: string[];
}) {
  const dataset = await queryBajasDataset({
    tab: params.tab || 'CONFIRMADAS',
    search: params.search || '',
    canalFilter: params.canalFilter || 'TODOS',
    origenBajaFilter: params.origenBajaFilter || [],
    tarifaFilter: params.tarifaFilter || [],
    dateFrom: params.dateFrom || null,
    dateTo: params.dateTo || null,
    penaltyFilter: params.penaltyFilter || 'TODOS',
    winbackFilter: params.winbackFilter || 'TODOS',
    selectedIds: params.selectedIds,
    exportAll: true,
  });

  const isPreaviso = dataset.tab === 'PREAVISO_PASO_11';
  const showPenalties = dataset.isBackofficeOrAdmin;

  const baseHeaders = [
    'CUPS',
    'Contrato',
    'Cliente / Razón Social',
    'NIF / CIF',
    'Teléfono',
    'Email',
    'Dirección Suministro',
    'Tarifa ATR',
    'Consumo Anual (MWh)',
    'Producto',
    'Meses Permanencia',
    'Canal',
    'Comercial',
    'Fecha Alta / Inicio Perm.',
    isPreaviso ? 'Fecha Prevista Baja (Paso 11)' : 'Fecha Baja Efectiva',
    ...(isPreaviso ? ['Días hasta Baja'] : ['Días Vida Contrato']),
    'Origen Baja ATR',
    'Incumplimiento Preaviso 30d',
    'Estado Recuperación (Winback)',
    'Producto Ofertado Winback',
    'Notas Winback',
  ];

  const penaltyHeaders = showPenalties
    ? [
        'Penalización Auto ERP (Base €)',
        'Penalización Aplicada (Base €)',
        'Estado Penalización',
        'Nº Factura Penalización',
      ]
    : [];

  const headers = [...baseHeaders, ...penaltyHeaders];

  const rows = dataset.bajas.map((b: any) => {
    const baseRow: any[] = [
      b.cups,
      b.contractCode || '',
      b.cliente,
      b.vatNumber || '',
      b.telefono || '',
      b.email || '',
      b.address || '',
      b.tarifa,
      Number(b.mwh || 0),
      b.producto,
      Number(b.permanenceMonths ?? 0),
      b.canal,
      b.comercial || '',
      b.fechaAlta,
      b.fechaBaja,
      ...(isPreaviso ? [b.diasHastaBaja ?? ''] : [Number(b.diasVida || 0)]),
      b.bajaProcess || 'Sin origen',
      b.isPreavisoBreached ? 'SÍ' : 'NO',
      b.winbackStatus || 'SIN_GESTION',
      b.winbackProductOffered || '',
      b.winbackNotes || '',
    ];

    if (showPenalties) {
      baseRow.push(
        Number(b.calculatedPenalty ?? 0),
        b.penalization !== null && b.penalization !== undefined ? Number(b.penalization) : '',
        b.penaltyStatus || 'PENDIENTE',
        b.penaltyInvoiceNumber || ''
      );
    }

    return baseRow;
  });

  const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    workbook,
    worksheet,
    isPreaviso ? 'Preavisos_Paso11' : 'Bajas_Confirmadas'
  );

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const fileName = isPreaviso ? 'export_preavisos_paso11.xlsx' : 'export_bajas_confirmadas.xlsx';

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return await buildBajasWorkbookResponse({
      tab: body.tab,
      search: body.search,
      canalFilter: body.canalFilter,
      origenBajaFilter: Array.isArray(body.origenBajaFilter) ? body.origenBajaFilter : [],
      tarifaFilter: Array.isArray(body.tarifaFilter) ? body.tarifaFilter : [],
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      penaltyFilter: body.penaltyFilter,
      winbackFilter: body.winbackFilter,
      selectedIds: Array.isArray(body.selectedIds) && body.selectedIds.length > 0 ? body.selectedIds : undefined,
    });
  } catch (error: any) {
    console.error('Error exporting bajas XLSX:', error);
    const status = String(error?.message || '').includes('No autorizado') ? 401 : 500;
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    return await buildBajasWorkbookResponse({
      tab: (searchParams.get('tab') as BajasTabMode) || 'CONFIRMADAS',
      search: searchParams.get('search') || '',
      canalFilter: searchParams.get('canal') || 'TODOS',
      dateFrom: searchParams.get('from') || null,
      dateTo: searchParams.get('to') || null,
      penaltyFilter: searchParams.get('penalty') || 'TODOS',
      winbackFilter: searchParams.get('winback') || 'TODOS',
    });
  } catch (error: any) {
    console.error('Error exporting bajas XLSX GET:', error);
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
  }
}
