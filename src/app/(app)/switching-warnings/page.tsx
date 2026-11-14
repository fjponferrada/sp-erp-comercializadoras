import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getPaginatedSwitchingEventsAction } from '@/app/actions/switchingActions';
import SwitchingWarningsClient from './SwitchingWarningsClient';

export const dynamic = 'force-dynamic';

export default async function SwitchingWarningsPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  if (['COMERCIAL', 'CANAL'].includes(userRole)) {
    redirect('/');
  }

  // Traemos todos los eventos (false) en vez de solo los warnings, con paginación de 100 (Regla 3)
  const result = await getPaginatedSwitchingEventsAction(1, 100, '', false, '', 'fechaSolicitud');

  const initialEvents = result.success ? result.events : [];
  const initialTotalCount = result.success ? result.totalCount : 0;

  return (
    <SwitchingWarningsClient 
      initialEvents={initialEvents as any} 
      initialTotalCount={initialTotalCount as number}
      userRole={userRole} 
    />
  );
}
