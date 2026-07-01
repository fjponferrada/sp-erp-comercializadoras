import Topbar from '@/components/Topbar';
import ImportarOmieClient from '@/components/compras/ImportarOmieClient';

export default function ImportarOmiePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Importar OMIE" />
      <div style={{ padding: '24px' }}>
        <ImportarOmieClient />
      </div>
    </div>
  );
}
