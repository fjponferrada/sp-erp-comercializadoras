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

  const contract = await prisma.contract.findUnique({
    where: { id: resolvedParams.id },
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
      where: { contractCode: contract.contractCode },
      select: { id: true, version: true, status: true, createdAt: true },
      orderBy: { version: 'desc' }
    });
  }

  // Fetch Switching Events for this CUPS, excluding irrelevant ones
  let switchingEvents: any[] = [];
  if (contract.supplyPointId) {
    switchingEvents = await prisma.switchingEvent.findMany({
      where: {
        supplyPointId: contract.supplyPointId,
        procesoBase: { notIn: ['F1', 'R1', 'P0', 'Q1', 'W1', 'T1'] }
      },
      orderBy: { fechaAviso: 'desc' }
    });
  }

  // Fetch Claims (R1) for this contract
  let claims: any[] = [];
  const claimsResult = await getClaimsAction(contract.id);
  if (claimsResult.success) {
    claims = claimsResult.data;
  }

  // Fetch F1 Invoices for this contract dynamically by dates
  let f1Invoices: any[] = [];
  if (contract.supplyPointId && contract.activationDate) {
    f1Invoices = await prisma.f1Invoice.findMany({
      where: {
        supplyPointId: contract.supplyPointId,
        fechaFin: { gte: contract.activationDate },
        ...(contract.terminationDate ? { fechaInicio: { lte: contract.terminationDate } } : {})
      },
      orderBy: { fechaEmision: 'desc' }
    });
  }

  // Fetch Historical Invoices for this CUPS across all contracts with permissions
  let historicalInvoices: any[] = [];
  if (contract.supplyPointId) {
    const role = sessionUser?.role || 'CLIENT';
    let invoicesWhere: any = { supplyPointId: contract.supplyPointId };

    if (role === 'SUPERADMIN') {
      // No extra filters, can see all history for the CUPS
    } else if (role === 'BACKOFFICE' || role === 'COMPANYADMIN') {
      // Only history within the same company
      invoicesWhere.companyId = (contract as any).companyId;
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
    product: contract.product,
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
