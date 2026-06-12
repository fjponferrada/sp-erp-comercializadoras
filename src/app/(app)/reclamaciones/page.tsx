import { auth } from '@/auth';
import { getClaimsAction } from '@/app/actions/claimsActions';
import ReclamacionesClient from './ReclamacionesClient';

export const dynamic = 'force-dynamic';

export default async function ReclamacionesPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  const result = await getClaimsAction();

  const initialClaims = result.success ? result.data : [];

  return (
    <ReclamacionesClient 
      initialClaims={initialClaims as any} 
      userRole={userRole} 
    />
  );
}
