import React from 'react';
import { prisma } from '@/lib/prisma';
import { Receipt } from 'lucide-react';
import FacturasClient from './FacturasClient';
import Topbar from '@/components/Topbar';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import { auth } from '@/auth';

export default async function InvoicesPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'user';

  const visibilityFilter = await getInvoiceVisibilityFilter();

  // Obtenemos solo la primera página de facturas para la carga inicial
  const { getPaginatedInvoicesAction } = await import('@/app/actions/invoiceActions');
  const result = await getPaginatedInvoicesAction(1, 100, '', '', '', '', '');
  const initialInvoices = result.success ? result.invoices : [];
  const totalCount = result.success ? result.totalCount : 0;

  // Contamos facturas pendientes de comunicar
  const pendingCount = await prisma.invoice.count({
    where: {
      ...visibilityFilter,
      communicatedAt: null,
      pdfUrl: { not: null },
      client: { 
        contactEmail: { not: null },
        NOT: { contactEmail: "" }
      }
    }
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar 
        title="Facturación" 
        subtitle="Gestión de recibos e importación de remesas del Switching"
        showSearch={false} 
      />
      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>



      <FacturasClient initialInvoices={initialInvoices as any} pendingCount={pendingCount} initialTotalCount={totalCount as number} />
      </div>
    </div>
  );
}
