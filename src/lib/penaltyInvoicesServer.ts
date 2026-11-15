import { prisma } from '@/lib/prisma';
import {
  parseMadridEndOfDay,
  parseMadridStartOfDay,
  requirePenaltyAdminAccess,
  round2,
} from '@/lib/bajasServer';

export interface PenaltyInvoicesQueryParams {
  page?: number;
  itemsPerPage?: number;
  searchTerm?: string;
  statusFilter?: string; // TODOS | EMITIDA | COMUNICADA
  paymentFilter?: string; // TODOS | PENDIENTE | PAGADA | IMPAGADA | ANULADA
  typeFilter?: string; // TODOS | PENALIZACION | ABONO
  dateFrom?: string | null;
  dateTo?: string | null;
  selectedIds?: string[];
  exportAll?: boolean;
}

export interface PenaltyInvoicesKpiSummary {
  totalCount: number;
  totalNetWithVat: number;
  totalNetBase: number;
  pendingCommunicateCount: number;
  paidAmount: number;
  paidCount: number;
  pendingCollectAmount: number;
  pendingCollectCount: number;
}

export function buildPenaltyInvoicesWhereClause(
  visibilityFilter: any,
  params: PenaltyInvoicesQueryParams
) {
  const andConditions: any[] = [
    {
      contract: {
        ...visibilityFilter,
      },
    },
  ];

  if (Array.isArray(params.selectedIds) && params.selectedIds.length > 0) {
    andConditions.push({ id: { in: params.selectedIds } });
  }

  const term = (params.searchTerm || '').trim();
  if (term) {
    andConditions.push({
      OR: [
        { invoiceNumber: { contains: term, mode: 'insensitive' } },
        { client: { businessName: { contains: term, mode: 'insensitive' } } },
        { client: { firstName: { contains: term, mode: 'insensitive' } } },
        { client: { lastName: { contains: term, mode: 'insensitive' } } },
        { client: { vatNumber: { contains: term, mode: 'insensitive' } } },
        { supplyPoint: { cups: { contains: term, mode: 'insensitive' } } },
        { contract: { contractCode: { contains: term, mode: 'insensitive' } } },
      ],
    });
  }

  if (params.statusFilter && params.statusFilter !== 'TODOS') {
    if (params.statusFilter === 'EMITIDA') {
      andConditions.push({ status: { not: 'COMUNICADA' } });
    } else {
      andConditions.push({ status: params.statusFilter });
    }
  }

  if (params.paymentFilter && params.paymentFilter !== 'TODOS') {
    andConditions.push({ paymentStatus: params.paymentFilter });
  }

  if (params.typeFilter && params.typeFilter !== 'TODOS') {
    andConditions.push({ invoiceType: params.typeFilter });
  }

  if (params.dateFrom || params.dateTo) {
    const issueRange: any = {};
    if (params.dateFrom) issueRange.gte = parseMadridStartOfDay(params.dateFrom);
    if (params.dateTo) issueRange.lte = parseMadridEndOfDay(params.dateTo);
    andConditions.push({ issueDate: issueRange });
  }

  return { AND: andConditions };
}

export async function queryPenaltyInvoicesDataset(params: PenaltyInvoicesQueryParams) {
  const ctx = await requirePenaltyAdminAccess();
  const page = Math.max(1, Number(params.page) || 1);
  const itemsPerPage = Math.max(1, Math.min(2000, Number(params.itemsPerPage) || 100));

  const whereClause = buildPenaltyInvoicesWhereClause(ctx.visibilityFilter, params);

  const [allMatchingForKpi, paginatedInvoices] = await Promise.all([
    prisma.penaltyInvoice.findMany({
      where: whereClause,
      select: {
        id: true,
        invoiceType: true,
        baseAmount: true,
        taxAmount: true,
        amount: true,
        status: true,
        paymentStatus: true,
      },
    }),
    prisma.penaltyInvoice.findMany({
      where: whereClause,
      include: {
        client: true,
        contract: {
          include: {
            brand: true,
            product: true,
          },
        },
        supplyPoint: true,
        rectifiedPenalty: {
          select: { id: true, invoiceNumber: true },
        },
        rectifications: {
          select: { id: true, invoiceNumber: true },
        },
      },
      orderBy: [{ issueDate: 'desc' }, { invoiceNumber: 'desc' }],
      ...(params.exportAll
        ? {}
        : {
            skip: (page - 1) * itemsPerPage,
            take: itemsPerPage,
          }),
    }),
  ]);

  let totalNetWithVat = 0;
  let totalNetBase = 0;
  let pendingCommunicateCount = 0;
  let paidAmount = 0;
  let paidCount = 0;
  let pendingCollectAmount = 0;
  let pendingCollectCount = 0;

  for (const row of allMatchingForKpi) {
    const isAbono = row.invoiceType === 'ABONO';
    const rawTotal = Number(row.amount || 0);
    const rawBase =
      row.baseAmount !== null && row.baseAmount !== undefined
        ? Number(row.baseAmount)
        : round2(rawTotal / 1.21);

    const signedTotal = isAbono ? -Math.abs(rawTotal) : Math.abs(rawTotal);
    const signedBase = isAbono ? -Math.abs(rawBase) : Math.abs(rawBase);

    totalNetWithVat += signedTotal;
    totalNetBase += signedBase;

    if (row.status !== 'COMUNICADA' && row.paymentStatus !== 'ANULADA') {
      pendingCommunicateCount++;
    }

    if (!isAbono) {
      if (row.paymentStatus === 'PAGADA') {
        paidAmount += Math.abs(rawTotal);
        paidCount++;
      } else if (row.paymentStatus === 'PENDIENTE' || row.paymentStatus === 'IMPAGADA') {
        pendingCollectAmount += Math.abs(rawTotal);
        pendingCollectCount++;
      }
    }
  }

  const kpis: PenaltyInvoicesKpiSummary = {
    totalCount: allMatchingForKpi.length,
    totalNetWithVat: round2(totalNetWithVat),
    totalNetBase: round2(totalNetBase),
    pendingCommunicateCount,
    paidAmount: round2(paidAmount),
    paidCount,
    pendingCollectAmount: round2(pendingCollectAmount),
    pendingCollectCount,
  };

  return {
    role: ctx.role,
    isBackofficeOrAdmin: ctx.isBackofficeOrAdmin,
    totalCount: allMatchingForKpi.length,
    kpis,
    invoices: paginatedInvoices,
  };
}
