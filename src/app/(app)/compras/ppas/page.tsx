import Topbar from '@/components/Topbar';
import PpaClient from './PpaClient';

export default function PpasPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Gestión de PPAs" />
      <div style={{ padding: '24px' }}>
        <PpaClient />
      </div>
    </div>
  );
}
