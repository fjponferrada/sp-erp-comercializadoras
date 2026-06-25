import Topbar from '@/components/Topbar';
import PreciosClient from './PreciosClient';

export default function PreciosComponentesPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Precio Componentes" />
      <div style={{ padding: '24px' }}>
        <PreciosClient />
      </div>
    </div>
  );
}
