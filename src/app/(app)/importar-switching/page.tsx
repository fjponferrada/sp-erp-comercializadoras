import { auth } from '@/auth';
import ImportarSwitchingClient from './ImportarSwitchingClient';

export const dynamic = 'force-dynamic';

export default async function ImportarSwitchingPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  return (
    <ImportarSwitchingClient userRole={userRole} />
  );
}
