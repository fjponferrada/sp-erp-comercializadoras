import React from 'react';
import InvoiceUploader from '@/components/facturas/InvoiceUploader';
import PdfUploader from '@/components/facturas/PdfUploader';
import Topbar from '@/components/Topbar';
import { auth } from '@/auth';

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
          <p className="text-red-500">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar 
        title="Importar Facturas" 
        subtitle="Importación masiva de facturas de Switching y vinculación automática de PDFs"
        showSearch={false} 
      />
      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InvoiceUploader />
          <PdfUploader />
        </div>
      </div>
    </div>
  );
}
