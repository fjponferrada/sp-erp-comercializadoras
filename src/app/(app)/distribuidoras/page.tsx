import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole } from '@/lib/companyContext';
import DistribuidorasClient from './DistribuidorasClient';

export default async function DistribuidorasPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  if (!hasAdminOrBackofficeRole((session.user as any).role)) {
    redirect('/');
  }

  return <DistribuidorasClient />;
}
