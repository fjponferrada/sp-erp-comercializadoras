import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import GenerarAnulacionClient from './GenerarAnulacionClient';

export const dynamic = 'force-dynamic';

export default async function GenerarAnulacionPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const userRole = (session.user as any)?.role || 'CANAL';
  if (['COMERCIAL', 'CANAL'].includes(userRole)) {
    redirect('/');
  }

  return <GenerarAnulacionClient />;
}
