import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import { notFound, redirect } from 'next/navigation';
import InvoiceDetailClient from '@/app/(app)/facturas/[id]/InvoiceDetailClient';
import {
  buildIngebauCanonicalFieldsSync,
  buildInvoiceTemplateData,
  getInclusiveEndDate,
  toUtcNoonFromMadridDate,
} from '@/lib/services/internalInvoiceMapper';

export const dynamic = 'force-dynamic';

export default async function InternalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  const sessionUser = session?.user as any;
  if (!sessionUser) {
    redirect('/login');
  }

  const visibilityFilter = (await getInvoiceVisibilityFilter()) as Record<string, any>;

  const inv = await prisma.internalInvoice.findFirst({
    where: {
      id,
      ...visibilityFilter,
    },
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
          product: true,
          user: true,
          supplyPoint: true,
          client: true,
          brand: { include: { company: true } },
        },
      },
    },
  });

  if (!inv) {
    notFound();
  }

  const templateData = await buildInvoiceTemplateData(inv);
  const canonicalData = buildIngebauCanonicalFieldsSync({
    invoice: inv,
    templateData,
    pdfUrl: inv.pdfUrl,
    xmlUrl: inv.xmlUrl,
  });

  // Resolver factura rectificada origen (tanto si procede de InternalInvoice como de histórico Ingebau en Invoice)
  let rectifiedInvoice: {
    id: string;
    invoiceNumber: string | null;
    issueDate: Date | null;
    totalAmount: number | null;
    invoiceType: string | null;
    href?: string;
  } | null = null;

  const origNum = String(canonicalData['Numero factura rectificada'] || '').trim();
  if (origNum) {
    const foundInternal = await prisma.internalInvoice.findFirst({
      where: {
        invoiceNumber: origNum,
        ...visibilityFilter,
      },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        totalAmount: true,
        invoiceType: true,
      },
    });
    if (foundInternal) {
      rectifiedInvoice = {
        ...foundInternal,
        href: `/facturas-internas/${foundInternal.id}`,
      };
    } else {
      const foundOfficial = await prisma.invoice.findFirst({
        where: {
          invoiceNumber: origNum,
          ...visibilityFilter,
        },
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          totalAmount: true,
          invoiceType: true,
        },
      });
      if (foundOfficial) {
        rectifiedInvoice = {
          ...foundOfficial,
          href: `/facturas/${foundOfficial.id}`,
        };
      }
    }
  }

  // Resolver rectificaciones / abonos posteriores emitidos contra esta factura interna
  const rectifications: Array<{
    id: string;
    invoiceNumber: string;
    issueDate: Date | null;
    totalAmount: number | null;
    invoiceType: string | null;
    href: string;
  }> = [];

  if (inv.invoiceNumber) {
    const childInternals = await prisma.internalInvoice.findMany({
      where: {
        id: { not: inv.id },
        status: { in: ['EMITIDA', 'ABONO', 'BORRADOR'] },
        invoiceData: {
          path: ['Numero factura rectificada'],
          equals: inv.invoiceNumber,
        },
        ...visibilityFilter,
      },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        totalAmount: true,
        invoiceType: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const r of childInternals) {
      rectifications.push({
        id: r.id,
        invoiceNumber: r.invoiceNumber || `BORRADOR-${r.id.slice(-6).toUpperCase()}`,
        issueDate: r.issueDate,
        totalAmount: r.totalAmount,
        invoiceType: r.invoiceType === 'Rectificadora' ? 'Rectificativa' : r.invoiceType,
        href: `/facturas-internas/${r.id}`,
      });
    }
  }

  const inclusiveEnd = getInclusiveEndDate(inv.billingStart, inv.billingEnd);
  const displayInvoiceNumber = inv.invoiceNumber || `PROFORMA-${inv.id.slice(-8).toUpperCase()}`;

  const mappedInvoice = {
    ...inv,
    invoiceNumber: displayInvoiceNumber,
    invoiceType: canonicalData['Tipo Factura'] || inv.invoiceType || 'Normal',
    client: inv.client || inv.contract?.client || null,
    clientId: inv.clientId || inv.contract?.clientId || '',
    supplyPoint:
      inv.supplyPoint || inv.contract?.supplyPoint || inv.f1Invoice?.supplyPoint || null,
    contract: inv.contract,
    issueDate: toUtcNoonFromMadridDate(templateData.issueDate || inv.issueDate) || inv.issueDate,
    paymentDate: toUtcNoonFromMadridDate(templateData.paymentDate),
    billingStart: toUtcNoonFromMadridDate(inv.billingStart) || inv.billingStart,
    billingEnd: toUtcNoonFromMadridDate(inclusiveEnd) || inclusiveEnd,
    subtotal1: canonicalData['Subtotal 1'],
    taxPercentage: canonicalData['Impuesto (%)'],
    taxAmount: canonicalData['Importe Impuesto'],
    totalMWh: canonicalData['Energía Total Consumida'],
    origin: canonicalData['Procedencia Hasta'] || inv.origin,
    pdfUrl: inv.pdfUrl || canonicalData.pdfUrl || null,
    xmlUrl: inv.xmlUrl || canonicalData.xmlUrl || null,
    invoiceData: canonicalData,
    rectifiedInvoice,
    rectifications,
  };

  const isDraft = inv.status === 'BORRADOR' || inv.status === 'REQUIERE_REPARACION';

  return (
    <InvoiceDetailClient
      initialInvoice={mappedInvoice}
      userRole={sessionUser?.role || 'CANAL'}
      backHref={isDraft ? '/facturacion/interna' : '/facturas-internas'}
      backLabel={isDraft ? 'Volver a Motor de Facturación' : 'Volver a Facturas Internas'}
      detailBasePath="/facturas-internas"
      proformaPdfUrl={`/api/facturacion/interna/proforma/${inv.id}`}
    />
  );
}
