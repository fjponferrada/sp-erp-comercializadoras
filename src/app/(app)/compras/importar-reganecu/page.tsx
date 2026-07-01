import Topbar from '@/components/Topbar';
import ReganecuImportClient from './ReganecuImportClient';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

export default async function ImportarReganecuPage() {
  const session = await auth();

  if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN' && session.user.role !== 'BACKOFFICE')) {
    redirect('/login');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Importar Liquidaciones REGANECU" />
      <div style={{ padding: '24px' }}>
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Subida de Archivos ZIP (REGANECU)
            </h2>
            <a 
              href="https://participa.esios.ree.es" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'var(--text-primary)',
                color: 'var(--bg-base)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'opacity 0.2s'
              }}
            >
              <ExternalLink size={16} />
              Acceder a ESIOS Participa
            </a>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.875rem' }}>
            Sube un archivo ZIP que contenga liquidaciones particulares de REE (ej. C2_liquidacion_AEDEN_202603.1.zip). También puedes subir un ZIP que contenga varios archivos ZIP de liquidaciones en su interior.
          </p>
          
          <ReganecuImportClient />
        </div>
      </div>
    </div>
  );
}
