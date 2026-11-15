import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import { notFound, redirect } from 'next/navigation';
import InvoiceDetailClient from './InvoiceDetailClient';

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;

  const session = await auth();
  const sessionUser = session?.user as any;
  if (!sessionUser) {
    redirect('/login');
  }

  const visibilityFilter = await getInvoiceVisibilityFilter();

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: resolvedParams.id,
      ...visibilityFilter,
    },
    include: {
      client: true,
      contract: {
        include: { product: true, user: true }
      },
      supplyPoint: true,
      invoice: {
        select: { id: true, invoiceNumber: true, issueDate: true, totalAmount: true, invoiceType: true }
      },
      otherInvoices: {
        select: { id: true, invoiceNumber: true, issueDate: true, totalAmount: true, invoiceType: true },
        orderBy: { issueDate: 'desc' }
      }
    }
  });

  if (!invoice) {
    notFound();
  }

  let mappedOrigin = invoice.origin;
  let mappedXmlUrl = invoice.xmlUrl;
  if (invoice.invoiceData && typeof invoice.invoiceData === 'object') {
    const d = invoice.invoiceData as any;
    if ((!mappedOrigin || mappedOrigin === 'INTERNAL_ENGINE') && d['Procedencia Hasta']) {
      mappedOrigin = d['Procedencia Hasta'];
    }
    if (!mappedXmlUrl) {
      mappedXmlUrl = d['xmlUrl'] || d['XML'] || d['xML'] || null;
    }
  }

  const mappedInvoice = {
    ...invoice,
    origin: mappedOrigin,
    xmlUrl: mappedXmlUrl,
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
