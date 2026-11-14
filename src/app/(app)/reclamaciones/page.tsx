import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getClaimsAction } from '@/app/actions/claimsActions';
import ReclamacionesClient from './ReclamacionesClient';

export const dynamic = 'force-dynamic';

export default async function ReclamacionesPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  if (['COMERCIAL', 'CANAL'].includes(userRole)) {
    redirect('/');
  }

  const result = await getClaimsAction(undefined, 1, 100, '', 'ALL');

  const initialClaims = result.success ? result.data : [];
  const initialTotalCount = result.success ? result.totalCount : 0;
  const initialStatusCounts = result.success ? result.statusCounts : { ALL: 0 };

  return (
    <ReclamacionesClient
      initialClaims={initialClaims}
      initialTotalCount={initialTotalCount}
      initialStatusCounts={initialStatusCounts}
      userRole={userRole}
    />
  );
}
