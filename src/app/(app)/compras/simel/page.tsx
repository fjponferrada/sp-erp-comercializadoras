import Topbar from '@/components/Topbar';
import SimelViewerClient from './SimelViewerClient';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Visor SIMEL | ERP',
};

export default async function SimelViewerPage() {
  const session = await auth();

  if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN' && session.user.role !== 'BACKOFFICE')) {
    redirect('/login');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Visor SIMEL" />
      <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        <SimelViewerClient />
      </div>
    </div>
  );
}
