import { auth } from '@/auth';
import { getPaginatedSwitchingEventsAction } from '@/app/actions/switchingActions';
import SwitchingWarningsClient from './SwitchingWarningsClient';

export const dynamic = 'force-dynamic';

export default async function SwitchingWarningsPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  // Traemos todos los eventos (false) en vez de solo los warnings, con paginación de 50
  const result = await getPaginatedSwitchingEventsAction(1, 50, '', false, '', 'fechaSolicitud');

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
