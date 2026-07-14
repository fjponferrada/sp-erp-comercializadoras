import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import ImportarSwitchingClient from './ImportarSwitchingClient';

export const dynamic = 'force-dynamic';

export default async function ImportarSwitchingPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  if (['COMERCIAL', 'CANAL'].includes(userRole)) {
    redirect('/');
  }

  return (
    <ImportarSwitchingClient userRole={userRole} />
  );
}
