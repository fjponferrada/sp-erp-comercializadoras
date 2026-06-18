import React from 'react';
import { prisma } from '@/lib/prisma';
import { Receipt } from 'lucide-react';
import InvoiceUploader from '@/components/facturas/InvoiceUploader';
import PdfUploader from '@/components/facturas/PdfUploader';
import FacturasClient from './FacturasClient';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import { auth } from '@/auth';

export default async function InvoicesPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'user';
  const showUploaders = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);

  const visibilityFilter = await getInvoiceVisibilityFilter();

  // Obtenemos solo la primera página de facturas para la carga inicial
  const { getPaginatedInvoicesAction } = await import('@/app/actions/invoiceActions');
  const result = await getPaginatedInvoicesAction(1, 100, '', '');
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Receipt className="text-rose-500" />
            Facturación
          </h1>
          <p className="text-slate-400 mt-1">Gestión de recibos e importación de remesas del Switching</p>
        </div>
      </div>

      {/* DRAG AND DROP ZONES */}
      {showUploaders && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InvoiceUploader />
          <PdfUploader />
        </div>
      )}

      <FacturasClient initialInvoices={initialInvoices as any} pendingCount={pendingCount} initialTotalCount={totalCount as number} />
    </div>
  );
}
