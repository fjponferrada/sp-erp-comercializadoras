import Topbar from '@/components/Topbar';
import ReganecuViewerClient from './ReganecuViewerClient';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { isComprasAuthorized } from '@/lib/reganecuServer';

export const dynamic = 'force-dynamic';

export default async function ReganecuViewerPage() {
  const session = await auth();

  if (!isComprasAuthorized(session)) {
    redirect('/login');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Visor REGANECU" showSearch={false} />
      <div style={{ padding: '24px' }}>
        <ReganecuViewerClient />
      </div>
    </div>
  );
}
