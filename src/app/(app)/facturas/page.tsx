import React from 'react';
import { prisma } from '@/lib/prisma';
import { Receipt } from 'lucide-react';
import InvoiceUploader from '@/components/facturas/InvoiceUploader';
import PdfUploader from '@/components/facturas/PdfUploader';
import FacturasClient from './FacturasClient';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';

export default async function InvoicesPage() {
  const visibilityFilter = await getInvoiceVisibilityFilter();

  // Obtenemos TODAS las facturas para el cliente, ordenadas por fecha (o en producción se puede paginar en bd)
  const allInvoicesRaw = await prisma.invoice.findMany({
    where: visibilityFilter,
    include: { client: true, contract: true, supplyPoint: true },
    orderBy: [
      { issueDate: 'desc' },
      { invoiceNumber: 'desc' }
    ]
  });

  const allInvoices = allInvoicesRaw.map(inv => {
    let proc = inv.procedenciaHasta || inv.origin;
    if (!proc && inv.invoiceData && typeof inv.invoiceData === 'object') {
      const d = inv.invoiceData as any;
      if (d['Procedencia Hasta']) proc = d['Procedencia Hasta'];
    }
    return {
      ...inv,
      origin: proc,
      desde: inv.desde,
      hasta: inv.hasta,
      contract: inv.contract,
      supplyPoint: inv.supplyPoint
    };
  });

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InvoiceUploader />
        <PdfUploader />
      </div>

      <FacturasClient initialInvoices={allInvoices} pendingCount={pendingCount} />
    </div>
  );
}
