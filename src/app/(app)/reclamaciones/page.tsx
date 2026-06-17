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

  const result = await getClaimsAction(undefined, 1, 50, "");

  const initialClaims = result.success ? result.data : [];
  const initialTotalCount = result.success && "totalCount" in result ? result.totalCount : 0;

  return (
    <ReclamacionesClient 
      initialClaims={initialClaims as any} 
      initialTotalCount={initialTotalCount}
      userRole={userRole} 
    />
  );
}
