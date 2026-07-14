import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import InvoiceDetailClient from './InvoiceDetailClient';

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const session = await auth();
  const sessionUser = session?.user;

  const invoice = await prisma.invoice.findUnique({
    where: { id: resolvedParams.id },
    include: {
      client: true,
      contract: {
        include: { product: true, user: true }
      },
      supplyPoint: true,
      invoice: true,
      otherInvoices: true
    }
  });

  if (!invoice) {
    notFound();
  }

  let mappedOrigin = invoice.origin;
  if (invoice.invoiceData && typeof invoice.invoiceData === 'object') {
    const d = invoice.invoiceData as any;
    if (d['Procedencia Hasta']) {
      mappedOrigin = d['Procedencia Hasta'];
    }
  }

  const mappedInvoice = {
    ...invoice,
    origin: mappedOrigin,
    contract: invoice.contract,
    supplyPoint: invoice.supplyPoint,
    rectifiedInvoice: invoice.invoice,
    rectifications: invoice.otherInvoices
  };

  return (
    <InvoiceDetailClient 
      initialInvoice={mappedInvoice} 
      userRole={sessionUser?.role || 'CANAL'} 
    />
  );
}
