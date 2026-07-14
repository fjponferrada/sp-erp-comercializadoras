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
    const visibilityFilter = await getInvoiceVisibilityFilter();
    
    // Convert visibility filter from 'Invoice' style to 'InternalInvoice'
    // where client is related through contract.client
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

    const skip = (page - 1) * itemsPerPage;
    
    const [invoicesRaw, totalCount] = await Promise.all([
      prisma.internalInvoice.findMany({
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
        ],
        skip,
        take: itemsPerPage,
      }),
      prisma.internalInvoice.count({ where: whereClause })
    ]);

    // Map to a format similar to what FacturasClient expects
    const invoices = invoicesRaw.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.id.slice(-8).toUpperCase(), // InternalInvoice does not have a formal invoiceNumber field in schema, using ID snippet
      invoiceType: inv.invoiceType || 'Normal',
      issueDate: inv.issueDate,
      totalAmount: inv.totalAmount || 0,
      pdfUrl: (inv.invoiceData as any)?.pdfUrl || null,
      clientId: inv.contract?.clientId,
      client: inv.contract?.client,
      supplyPointId: inv.contract?.supplyPointId,
      supplyPoint: inv.contract?.supplyPoint,
      billingStart: inv.billingStart,
      billingEnd: inv.billingEnd,
      origin: inv.origin,
      totalMWh: inv.totalMWh || 0,
      communicatedAt: null // Not applicable for internal invoices yet
    }));

    return { success: true, invoices, totalCount };
  } catch (error: any) {
    console.error("Error fetching paginated internal invoices:", error);
    return { success: false, error: error.message };
  }
}
