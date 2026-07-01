import Topbar from '@/components/Topbar';
import ReganecuViewerClient from './ReganecuViewerClient';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function ReganecuViewerPage() {
  const session = await auth();

  if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN' && session.user.role !== 'BACKOFFICE')) {
    redirect('/login');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Visor REGANECU" />
      <div style={{ padding: '24px' }}>
        <ReganecuViewerClient />
      </div>
    </div>
  );
}
