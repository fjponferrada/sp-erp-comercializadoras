import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import GenerarBajaClient from './GenerarBajaClient';

export const dynamic = 'force-dynamic';

export default async function GenerarBajaPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const userRole = (session.user as any)?.role || 'CANAL';
  if (['COMERCIAL', 'CANAL'].includes(userRole)) {
    redirect('/');
  }

  return <GenerarBajaClient />;
}
