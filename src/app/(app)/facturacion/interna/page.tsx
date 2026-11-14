import { prisma } from '@/lib/prisma';
import FacturacionClient from './FacturacionClient';
import Topbar from '@/components/Topbar';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function FacturacionInternaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  const visibilityFilter = (await getInvoiceVisibilityFilter()) as Record<string, any>;
  const params = await searchParams;
  const searchQ = (params?.q || '').trim();

  const pendingAndConditions: any[] = [
    { internalInvoices: { none: {} } },
    { contractId: { not: null } },
  ];

  if (visibilityFilter.id) {
    pendingAndConditions.push({ id: visibilityFilter.id });
  } else if (Object.keys(visibilityFilter).length > 0) {
    pendingAndConditions.push({ contract: visibilityFilter });
  }

  if (searchQ) {
    const qUpper = searchQ.toUpperCase();

    if (qUpper.startsWith('ES')) {
      pendingAndConditions.push({
        contract: {
          supplyPoint: { cups: { startsWith: qUpper } },
        },
      });
    } else if (/\d/.test(searchQ) && searchQ.length <= 30) {
      pendingAndConditions.push({
        OR: [
          { numeroFactura: { contains: searchQ, mode: 'insensitive' } },
          { contract: { client: { vatNumber: { contains: searchQ, mode: 'insensitive' } } } },
        ],
      });
    } else {
      pendingAndConditions.push({
        contract: {
          client: {
            OR: [
              { businessName: { contains: searchQ, mode: 'insensitive' } },
              { firstName: { contains: searchQ, mode: 'insensitive' } },
              { lastName: { contains: searchQ, mode: 'insensitive' } },
            ],
          },
        },
      });
    }
  }

  const pendingF1s = await prisma.f1Invoice.findMany({
    where: { AND: pendingAndConditions },
    include: {
      contract: {
        include: {
          client: true,
          supplyPoint: true,
        },
      },
      invoices: {
        where: { OR: [{ origin: null }, { origin: { not: 'INTERNAL_ENGINE' } }] },
        select: { id: true, pdfUrl: true, totalAmount: true, invoiceType: true },
      },
    },
    orderBy: {
      fechaEmision: 'desc',
    },
    take: 500,
  });

  const drafts = await prisma.internalInvoice.findMany({
    where: {
      AND: [
        visibilityFilter,
        { status: { in: ['BORRADOR', 'REQUIERE_REPARACION'] } },
      ],
    },
    include: {
      client: true,
      supplyPoint: true,
      contract: {
        include: {
          client: true,
          supplyPoint: true,
        },
      },
      f1Invoice: {
        include: {
          invoices: {
        where: { OR: [{ origin: null }, { origin: { not: 'INTERNAL_ENGINE' } }] },
        select: { id: true, pdfUrl: true, totalAmount: true, invoiceType: true },
      },
        },
      },
    },
    orderBy: [{ billingEnd: 'desc' }, { createdAt: 'desc' }],
  });

  const historicalInvoices = await prisma.internalInvoice.findMany({
    where: {
      AND: [
        visibilityFilter,
        { status: { in: ['EMITIDA', 'ABONO'] } },
      ],
    },
    select: {
      id: true,
      supplyPointId: true,
      billingStart: true,
      billingEnd: true,
      contract: { select: { supplyPointId: true } },
      invoiceType: true,
    },
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Facturación Interna (Motor de Pruebas)"
        subtitle="Genera facturas desde los archivos F1, revísalas y confírmalas."
        showSearch={false}
      />
      <div
        style={{
          padding: '24px 32px',
          maxWidth: '1600px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <FacturacionClient
          pendingF1s={JSON.parse(JSON.stringify(pendingF1s))}
          drafts={JSON.parse(JSON.stringify(drafts))}
          historicalInvoices={JSON.parse(JSON.stringify(historicalInvoices))}
        />
      </div>
    </div>
  );
}
