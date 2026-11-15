import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Topbar from '@/components/Topbar';
import { hasAdminOrBackofficeRole } from '@/lib/companyContext';
import { queryPenaltyInvoicesDataset } from '@/lib/penaltyInvoicesServer';
import FacturasPenalizacionesClient from './FacturasPenalizacionesClient';

export const dynamic = 'force-dynamic';

export default async function FacturasPenalizacionesPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role || '';

  if (!session?.user || !hasAdminOrBackofficeRole(userRole)) {
    redirect('/');
  }

  const initialData = await queryPenaltyInvoicesDataset({
    page: 1,
    itemsPerPage: 100,
  });

  return (
    <>
      <Topbar
        title="Facturas de Penalizaciones"
        subtitle="Gestión contable, comunicación por email, abonos rectificativos y control de cobro"
      />
      <FacturasPenalizacionesClient
        initialInvoices={initialData.invoices}
        initialTotalCount={initialData.totalCount}
        initialKpis={initialData.kpis}
        userRole={initialData.role}
      />
    </>
  );
}
