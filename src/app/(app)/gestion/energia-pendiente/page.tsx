import Topbar from '@/components/Topbar';
import EnergiaPendienteClient from '@/components/gestion/EnergiaPendienteClient';

export default function EnergiaPendientePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Energía Pendiente Liquidar" />
      <div style={{ padding: '24px' }}>
        <EnergiaPendienteClient />
      </div>
    </div>
  );
}
