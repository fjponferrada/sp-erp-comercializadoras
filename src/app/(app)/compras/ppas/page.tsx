import Topbar from '@/components/Topbar';
import PpaClient from './PpaClient';

export default function PpasPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      <Topbar
        title="Gestión de PPAs"
        subtitle="Acuerdos bilaterales físicos, coberturas financieras (CfD), liquidaciones OMIE y exposición MtM."
        showSearch={false}
      />
      <div style={{ padding: '24px 28px 48px', flex: 1 }}>
        <PpaClient />
      </div>
    </div>
  );
}
