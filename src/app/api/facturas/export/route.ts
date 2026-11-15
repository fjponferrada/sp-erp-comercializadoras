import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import { buildInvoiceListWhereClause } from '@/app/actions/invoiceActions';
import { buildOfficialInvoicesExcelBuffer } from '@/lib/services/invoiceExportHelper';
import { auth } from '@/auth';

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

  const buffer = buildOfficialInvoicesExcelBuffer(invoicesRaw, 'Facturas');

  return new Response(new Uint8Array(buffer), {
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
