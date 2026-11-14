import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ContractDetailClient from './ContractDetailClient';
import { getClaimsAction } from '@/app/actions/claimsActions';

export const dynamic = 'force-dynamic';

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const session = await auth();
  const sessionUser = session?.user;
  
  let maxRenewalDays = 45; // Default
  let dbUser = null;
  if (sessionUser?.email) {
    dbUser = await prisma.user.findUnique({
      where: { email: sessionUser.email },
      include: { channel: true }
    });
    if (dbUser?.channel?.maxRenewalDays) {
      maxRenewalDays = dbUser.channel.maxRenewalDays;
    }
  }

  const { getUserVisibilityFilter } = await import('@/lib/permissions');
  const visibilityFilter = await getUserVisibilityFilter();

  const contract = await prisma.contract.findFirst({
    where: {
      id: resolvedParams.id,
      ...visibilityFilter
    },
    include: {
      Lead: {
        include: {
          documents: true
        }
      },
      client: true,
      supplyPoint: true,
      user: true,
      product: true,
      invoices: {
        orderBy: { issueDate: 'desc' }
      }
    }
  });

  if (!contract) {
    notFound();
  }
  
  let versions: any[] = [];
  if (contract.contractCode) {
    versions = await prisma.contract.findMany({
      where: { contractCode: contract.contractCode, ...visibilityFilter },
      select: { id: true, version: true, status: true, createdAt: true },
      orderBy: { version: 'desc' }
    });
  }

  // Regla 58 y Regla 124: Agrupar histórico completo del contador físico por los primeros 20 caracteres del CUPS
  const rawCups = contract.supplyPoint?.cups || contract.Lead?.cups || '';
  const cups20 = rawCups && !rawCups.startsWith('CUPS_MOCK') ? rawCups.substring(0, 20) : '';
  let allSupplyPointIds: string[] = contract.supplyPointId ? [contract.supplyPointId] : [];
  if (cups20.length >= 20) {
    const matchingSps = await prisma.supplyPoint.findMany({
      where: {
        cups: { startsWith: cups20 },
        ...(contract.brandId ? { brandId: contract.brandId } : {})
      },
      select: { id: true }
    });
    if (matchingSps.length > 0) {
      allSupplyPointIds = Array.from(new Set([...allSupplyPointIds, ...matchingSps.map(sp => sp.id)]));
    }
  }

  // Fetch Switching Events for this CUPS, excluding irrelevant ones
  let switchingEvents: any[] = [];
  if (allSupplyPointIds.length > 0) {
    switchingEvents = await prisma.switchingEvent.findMany({
      where: {
        supplyPointId: { in: allSupplyPointIds },
        procesoBase: { notIn: ['F1', 'R1', 'P0', 'Q1', 'W1', 'T1'] }
      },
      orderBy: { fechaAviso: 'desc' }
    });
  }

  // Fetch Claims (R1) for this contract and all SupplyPoint clones of this CUPS (Regla 21 / Regla 190)
  let claims: any[] = [];
  const claimsResult = await getClaimsAction(
    { contractId: contract.id, supplyPointIds: allSupplyPointIds },
    1,
    0
  );
  if (claimsResult.success) {
    claims = claimsResult.data;
  }

  // Fetch F1 Invoices for this contract dynamically by dates (Regla 56 y Regla 178)
  let f1Invoices: any[] = [];
  if (allSupplyPointIds.length > 0 && contract.activationDate) {
    f1Invoices = await prisma.f1Invoice.findMany({
      where: {
        supplyPointId: { in: allSupplyPointIds },
        fechaFin: { gte: contract.activationDate },
        ...(contract.terminationDate ? { fechaInicio: { lte: contract.terminationDate } } : {})
      },
      orderBy: { fechaEmision: 'desc' }
    });
  }

  // Fetch Historical Invoices for this CUPS across all contracts with permissions (Regla 93 y Regla 124)
  let historicalInvoices: any[] = [];
  if (allSupplyPointIds.length > 0) {
    const role = sessionUser?.role || 'CLIENT';
    let invoicesWhere: any = { supplyPointId: { in: allSupplyPointIds } };

    if (role === 'SUPERADMIN') {
      // No extra filters, can see all history for the CUPS
    } else if (role === 'BACKOFFICE' || role === 'COMPANYADMIN') {
      // Only history within the same brand/company
      if (contract.client?.brandId) {
        invoicesWhere.client = { brandId: contract.client.brandId };
      }
    } else if (role === 'CANAL') {
      // Only invoices tied to contracts belonging to their channel
      invoicesWhere.contract = { user: { channelId: dbUser?.channelId } };
    } else if (role === 'COMERCIAL') {
      // Only invoices tied to contracts belonging to them
      invoicesWhere.contract = { userId: dbUser?.id };
    } else {
      // CLIENT or fallback: only their own client's invoices
      invoicesWhere.clientId = contract.clientId;
    }

    historicalInvoices = await prisma.invoice.findMany({
      where: invoicesWhere,
      orderBy: { issueDate: 'asc' }
    });
  }

  // Regla 68: Resolución resiliente del producto si el contrato viene de histórico
  let resolvedProduct: any = contract.product;
  if (!resolvedProduct && contract.Lead?.product) {
    const prodRef = String(contract.Lead.product).trim();
    if (prodRef.startsWith('cm')) {
      resolvedProduct = await prisma.product.findUnique({ where: { id: prodRef } });
    } else if (prodRef) {
      resolvedProduct = await prisma.product.findFirst({
        where: {
          name: prodRef,
          ...(contract.brandId ? { brandId: contract.brandId } : {})
        }
      });
    }
  }

  let finalDistributorName = contract.supplyPoint?.distributorName;
  if (!finalDistributorName || /^\d{4}$/.test(contract.supplyPoint?.distributor || '')) {
     const cups = contract.supplyPoint?.cups || contract.Lead?.cups || '';
     const reeCode = contract.supplyPoint?.distributorReeCode || cups.substring(2, 6);
     if (reeCode && reeCode.length === 4) {
        const dbDistri = await prisma.distributor.findFirst({ where: { reeCode } });
        if (dbDistri) {
           finalDistributorName = dbDistri.name;
        }
     }
  }

  // Remap uppercase relations to lowercase for the UI component
  const uiContract = {
    ...contract,
    lead: contract.Lead ? { ...contract.Lead, documents: contract.Lead.documents } : null,
    client: contract.client,
    supplyPoint: {
      ...contract.supplyPoint,
      distributorName: finalDistributorName || contract.supplyPoint?.distributorName,
    },
    user: contract.user,
    product: resolvedProduct,
    invoices: contract.invoices,
    f1Invoices,
    switchingEvents,
    claims,
    historicalInvoices
  };

  return (
    <ContractDetailClient 
      initialContract={uiContract} 
      userRole={sessionUser?.role || 'CANAL'} 
      maxRenewalDays={maxRenewalDays} 
      versions={versions}
    />
  );
}
