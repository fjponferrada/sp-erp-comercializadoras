'use server';

import { prisma } from '@/lib/prisma';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';

export async function getPaginatedConfirmedInternalInvoicesAction(
  page: number,
  itemsPerPage: number,
  searchTerm: string,
  filterType: string,
  dateFrom?: string,
  dateTo?: string
) {
  try {
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

    const whereClause = { AND: andConditions };
    const skip = (page - 1) * itemsPerPage;

    const [invoicesRaw, totalCount] = await Promise.all([
      prisma.internalInvoice.findMany({
        where: whereClause,
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
        skip,
        take: itemsPerPage,
      }),
      prisma.internalInvoice.count({ where: whereClause }),
    ]);

    const invoices = invoicesRaw.map((inv) => {
      const iData = (inv.invoiceData as Record<string, any>) || {};
      const resolvedOrigin =
        (inv.origin && inv.origin !== 'INTERNAL_ENGINE' ? inv.origin : null) ||
        iData['Procedencia Hasta'] ||
        inv.origin;
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber || inv.id.slice(-8).toUpperCase(),
        invoiceType: iData['Tipo Factura'] || inv.invoiceType || 'Normal',
        issueDate: inv.issueDate,
        totalAmount: inv.totalAmount || 0,
        pdfUrl: inv.pdfUrl || iData.pdfUrl || null,
        xmlUrl: inv.xmlUrl || iData.xmlUrl || null,
        clientId: inv.clientId || inv.contract?.clientId || '',
        client: inv.client || inv.contract?.client || null,
        supplyPointId: inv.supplyPointId || inv.contract?.supplyPointId || null,
        supplyPoint: inv.supplyPoint || inv.contract?.supplyPoint || null,
        billingStart: inv.billingStart,
        billingEnd: inv.billingEnd,
        origin: resolvedOrigin,
        totalMWh: inv.totalMWh || 0,
        communicatedAt: inv.communicatedAt || null,
      };
    });

    return { success: true, invoices, totalCount };
  } catch (error: any) {
    console.error('Error fetching paginated internal invoices:', error);
    return { success: false, error: error.message };
  }
}
