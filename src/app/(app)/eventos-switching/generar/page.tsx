import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import GenerarSwitchingClient from './GenerarSwitchingClient';

export const dynamic = 'force-dynamic';

export default async function GenerarSwitchingPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  if (['COMERCIAL', 'CANAL'].includes(userRole)) {
    redirect('/');
  }

  return <GenerarSwitchingClient />;
}
