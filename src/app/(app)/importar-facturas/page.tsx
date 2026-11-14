import React from 'react';
import InvoiceUploader from '@/components/facturas/InvoiceUploader';
import PdfUploader from '@/components/facturas/PdfUploader';
import Topbar from '@/components/Topbar';
import { auth } from '@/auth';
import { Info } from 'lucide-react';

export default async function ImportarFacturasPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'user';
  const showUploaders = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);

  if (!showUploaders) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Topbar
          title="Importar Facturas"
          subtitle="Importación masiva de facturas de Switching y PDFs"
          showSearch={false}
        />
        <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto' }}>
          <div className="card" style={{ padding: '24px', color: '#fb7185' }}>
            No tienes permisos para acceder a esta página.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Importar Facturas"
        subtitle="Importación masiva de remesas de Ingebau / Switching y vinculación automática de PDFs y XMLs"
        showSearch={false}
      />
      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div
          className="card flex items-start gap-3"
          style={{ padding: '14px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <Info size={18} style={{ color: 'var(--lime)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Flujo recomendado:</strong> sube primero el fichero <strong>CSV o Excel</strong> exportado de Ingebau para registrar los importes, consumos y enlazar cada recibo con su Cliente, Suministro (CUPS+CIF), Contrato y F1 de distribuidora. A continuación, arrastra los archivos <strong>PDF y/o XML</strong> cuyo nombre coincida con el número de factura (ej. <code style={{ fontFamily: 'monospace' }}>A260920312.pdf</code>).
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InvoiceUploader />
          <PdfUploader />
        </div>
      </div>
    </div>
  );
}
