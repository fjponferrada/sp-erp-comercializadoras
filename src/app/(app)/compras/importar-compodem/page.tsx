import Topbar from '@/components/Topbar';
import ImportarClient from './ImportarClient';

export default function ImportarCompodemPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Importar COMPODEM" />
      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <ImportarClient />
      </div>
    </div>
  );
}
