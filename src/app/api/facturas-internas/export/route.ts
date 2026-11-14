import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import * as xlsx from 'xlsx';
import { auth } from '@/auth';
import {
  formatMadridDateEs,
  formatMadridInclusiveEndEs,
} from '@/lib/services/internalInvoiceMapper';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search') || '';
    const filterType = searchParams.get('type') || '';
    const dateFrom = searchParams.get('from') || '';
    const dateTo = searchParams.get('to') || '';

    const visibilityFilter = (await getInvoiceVisibilityFilter()) as Record<string, any>;

    const andConditions: any[] = [
      visibilityFilter,
      { status: { in: ['EMITIDA', 'ABONO'] } },
    ];

    if (filterType) {
      andConditions.push({ invoiceType: filterType });
    }

    if (dateFrom || dateTo) {
      const issueDateFilter: Record<string, Date> = {};
      if (dateFrom) {
        issueDateFilter.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        issueDateFilter.lte = endOfDay;
      }
      andConditions.push({ issueDate: issueDateFilter });
    }

    if (searchTerm) {
      andConditions.push({
        OR: [
          { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
          { id: { contains: searchTerm, mode: 'insensitive' } },
          { client: { businessName: { contains: searchTerm, mode: 'insensitive' } } },
          { client: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
          { client: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
          { client: { vatNumber: { contains: searchTerm, mode: 'insensitive' } } },
          { supplyPoint: { cups: { contains: searchTerm, mode: 'insensitive' } } },
          { contract: { supplyPoint: { cups: { contains: searchTerm, mode: 'insensitive' } } } },
        ],
      });
    }

    const invoicesRaw = await prisma.internalInvoice.findMany({
      where: { AND: andConditions },
      include: {
        client: true,
        supplyPoint: true,
        contract: {
          include: {
            client: true,
            supplyPoint: true,
          },
        },
      },
      orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
    });

    const rows = invoicesRaw.map((inv) => {
      const clientObj = inv.client || inv.contract?.client;
      const spObj = inv.supplyPoint || inv.contract?.supplyPoint;
      const clientName =
        clientObj?.businessName ||
        (clientObj ? `${clientObj.firstName || ''} ${clientObj.lastName || ''}`.trim() : '');
      const cif = clientObj?.vatNumber || '';

      return [
        inv.invoiceNumber || inv.id.slice(-8).toUpperCase(),
        inv.contract?.contractCode || '',
        clientName,
        cif,
        spObj?.cups || '',
        inv.invoiceType || 'Normal',
        inv.issueDate ? formatMadridDateEs(inv.issueDate) : '',
        inv.billingStart ? formatMadridDateEs(inv.billingStart) : '',
        inv.billingEnd ? formatMadridInclusiveEndEs(inv.billingStart, inv.billingEnd) : '',
        inv.totalMWh || 0,
        (inv.totalMWh || 0) * 1000,
        inv.subtotal1 || 0,
        inv.taxAmount || 0,
        inv.totalAmount || 0,
        inv.margin || 0,
        inv.origin || '',
        inv.f1InvoiceId || '',
      ];
    });

    const headers = [
      'Factura Interna',
      'Contrato',
      'Cliente',
      'CIF',
      'CUPS',
      'Tipo Factura',
      'Fecha Emisión',
      'Desde',
      'Hasta',
      'Total MWh',
      'Total kWh',
      'Base Imponible (€)',
      'Impuestos (€)',
      'Total Factura (€)',
      'Margen (€)',
      'Procedencia',
      'ID F1',
    ];

    const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Facturas Internas');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="export_facturas_internas.xlsx"',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
