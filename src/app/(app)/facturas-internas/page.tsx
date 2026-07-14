import React from 'react';
import { prisma } from '@/lib/prisma';
import Topbar from '@/components/Topbar';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import { auth } from '@/auth';
import FacturasInternasClient from './FacturasInternasClient';

export default async function FacturasInternasPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'user';

  const visibilityFilter = await getInvoiceVisibilityFilter();

  const { getPaginatedConfirmedInternalInvoicesAction } = await import('@/app/actions/internalInvoiceActions');
  const result = await getPaginatedConfirmedInternalInvoicesAction(1, 100, '', '');
  const initialInvoices = result.success ? result.invoices : [];
  const totalCount = result.success ? result.totalCount : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar 
        title="Histórico Facturas Internas" 
        subtitle="Consulta de facturas emitidas por el motor de facturación propio"
        showSearch={false} 
      />
      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <FacturasInternasClient 
          initialInvoices={initialInvoices as any} 
          initialTotalCount={totalCount as number} 
        />
      </div>
    </div>
  );
}
