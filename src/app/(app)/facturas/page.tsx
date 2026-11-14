import React from 'react';
import { prisma } from '@/lib/prisma';
import FacturasClient from './FacturasClient';
import Topbar from '@/components/Topbar';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import { getPaginatedInvoicesAction, getInvoiceFilterOptionsAction } from '@/app/actions/invoiceActions';

export default async function InvoicesPage() {
  const visibilityFilter = await getInvoiceVisibilityFilter();

  const [result, invoiceTypes, pendingCount] = await Promise.all([
    getPaginatedInvoicesAction(1, 100, '', '', '', '', '', ''),
    getInvoiceFilterOptionsAction(),
    prisma.invoice.count({
      where: {
        ...visibilityFilter,
        communicatedAt: null,
        AND: [
          { pdfUrl: { startsWith: 'http' } },
          { NOT: { pdfUrl: { contains: 'airtable' } } },
        ],
        client: {
          OR: [
            { invoiceEmail: { not: null }, NOT: { invoiceEmail: '' } },
            { contactEmail: { not: null }, NOT: { contactEmail: '' } },
          ],
        },
      },
    }),
  ]);

  const initialInvoices = result.success ? result.invoices : [];
  const totalCount = result.success ? result.totalCount : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Facturación"
        subtitle="Gestión de recibos e importación de remesas del Switching"
        showSearch={false}
      />
      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <FacturasClient
          initialInvoices={initialInvoices as any}
          pendingCount={pendingCount}
          initialTotalCount={totalCount as number}
          invoiceTypes={invoiceTypes}
        />
      </div>
    </div>
  );
}
