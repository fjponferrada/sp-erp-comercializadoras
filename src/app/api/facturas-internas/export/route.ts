import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import * as xlsx from 'xlsx';
import { auth } from '@/auth';

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

    const visibilityFilter = await getInvoiceVisibilityFilter();
    
    const internalVisibilityFilter = visibilityFilter.client?.brandId 
      ? { contract: { client: { brandId: visibilityFilter.client.brandId } } } 
      : {};

    const whereClause: any = { 
      status: 'EMITIDA',
      ...internalVisibilityFilter 
    };

    if (filterType) {
      whereClause.invoiceType = filterType;
    }

    if (dateFrom || dateTo) {
      whereClause.issueDate = {};
      if (dateFrom) {
        whereClause.issueDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        whereClause.issueDate.lte = endOfDay;
      }
    }

    if (searchTerm) {
      const isCups = searchTerm.toUpperCase().startsWith('ES') && searchTerm.length >= 18;
      const isVatNumber = /^[A-Z0-9]{8,10}$/i.test(searchTerm) && !isCups;
      const isInvoiceNumber = /^[A-Z0-9]{6,}$/i.test(searchTerm) && !isCups && !isVatNumber;

      if (isCups) {
        whereClause.OR = [
          { contract: { supplyPoint: { cups: { contains: searchTerm, mode: 'insensitive' } } } }
        ];
      } else if (isVatNumber) {
        whereClause.OR = [
          { contract: { client: { vatNumber: { contains: searchTerm, mode: 'insensitive' } } } },
          { id: { contains: searchTerm, mode: 'insensitive' } },
        ];
      } else if (isInvoiceNumber && !searchTerm.includes(' ')) {
        whereClause.OR = [
          { id: { contains: searchTerm, mode: 'insensitive' } },
        ];
      } else {
        whereClause.OR = [
          { id: { contains: searchTerm, mode: 'insensitive' } },
          { contract: { client: { businessName: { contains: searchTerm, mode: 'insensitive' } } } },
          { contract: { client: { firstName: { contains: searchTerm, mode: 'insensitive' } } } },
          { contract: { client: { lastName: { contains: searchTerm, mode: 'insensitive' } } } },
          { contract: { client: { vatNumber: { contains: searchTerm, mode: 'insensitive' } } } },
          { contract: { supplyPoint: { cups: { contains: searchTerm, mode: 'insensitive' } } } },
        ];
      }
    }

    const invoicesRaw = await prisma.internalInvoice.findMany({
      where: whereClause,
      include: { 
        contract: {
          include: {
            client: true,
            supplyPoint: true
          }
        }
      },
      orderBy: [
        { issueDate: 'desc' },
        { id: 'desc' }
      ]
    });

    const rows = invoicesRaw.map(inv => {
      const clientName = inv.contract?.client?.businessName || (inv.contract?.client ? `${inv.contract.client.firstName || ''} ${inv.contract.client.lastName || ''}`.trim() : '');
      const cif = inv.contract?.client?.vatNumber || '';
      
      const formatDateES = (date: Date | null | undefined) => {
        if (!date) return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const row = [
        inv.id.slice(-8).toUpperCase(),
        inv.contract?.contractCode || '',
        clientName,
        cif,
        inv.contract?.supplyPoint?.cups || '',
        inv.invoiceType || 'Normal',
        formatDateES(inv.issueDate),
        formatDateES(inv.billingStart),
        formatDateES(inv.billingEnd),
        inv.totalMWh || 0,
        inv.subtotal1 || 0,
        inv.taxAmount || 0,
        inv.totalAmount || 0,
        inv.margin || 0,
        inv.origin || '',
        inv.f1InvoiceId || ''
      ];

      return row;
    });

    const headers = [
      'Factura Interna', 'Contrato', 'Cliente', 'CIF', 'CUPS', 'Tipo Factura', 'Fecha Emision',
      'Desde', 'Hasta', 'Total MWh', 'Base Imponible', 'Impuestos', 'Total Factura', 'Margen', 'Procedencia', 'ID F1'
    ];

    const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Facturas Internas");
    
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="export_facturas_internas.xlsx"',
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
