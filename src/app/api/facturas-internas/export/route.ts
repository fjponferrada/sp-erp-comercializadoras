import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import { auth } from '@/auth';
import {
  buildIngebauCanonicalFieldsSync,
  getInclusiveEndDate,
  toUtcNoonFromMadridDate,
} from '@/lib/services/internalInvoiceMapper';
import { buildOfficialInvoicesExcelBuffer } from '@/lib/services/invoiceExportHelper';

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
      if (filterType === 'Rectificativa' || filterType === 'Rectificadora') {
        andConditions.push({ invoiceType: { in: ['Rectificativa', 'Rectificadora'] } });
      } else {
        andConditions.push({ invoiceType: filterType });
      }
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
        client: {
          include: {
            brand: { include: { company: true } },
          },
        },
        company: true,
        supplyPoint: true,
        f1Invoice: {
          include: { supplyPoint: true },
        },
        contract: {
          include: {
            client: true,
            supplyPoint: true,
            product: true,
            user: { select: { name: true } },
            brand: { include: { company: true } },
          },
        },
      },
      orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
    });

    const normalizedInvoices = invoicesRaw.map((inv) => {
      const canonical = buildIngebauCanonicalFieldsSync({ invoice: inv });
      return {
        ...inv,
        invoiceNumber: inv.invoiceNumber || inv.id.slice(-8).toUpperCase(),
        invoiceType: canonical['Tipo Factura'] || inv.invoiceType || 'Normal',
        issueDate: toUtcNoonFromMadridDate(inv.issueDate) || inv.issueDate,
        billingStart: toUtcNoonFromMadridDate(inv.billingStart) || inv.billingStart,
        billingEnd:
          toUtcNoonFromMadridDate(getInclusiveEndDate(inv.billingStart, inv.billingEnd)) ||
          inv.billingEnd,
        subtotal1: canonical['Subtotal 1'],
        taxPercentage: canonical['Impuesto (%)'],
        taxAmount: canonical['Importe Impuesto'],
        totalMWh: canonical['Energía Total Consumida'],
        origin: canonical['Procedencia Hasta'] || inv.origin,
        invoiceData: canonical,
      };
    });

    const buffer = buildOfficialInvoicesExcelBuffer(normalizedInvoices, 'Facturas Internas');

    return new Response(new Uint8Array(buffer), {
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
