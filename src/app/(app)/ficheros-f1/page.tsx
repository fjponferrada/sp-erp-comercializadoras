import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import FicherosF1Client from './FicherosF1Client';

export const metadata = {
  title: 'Ficheros F1',
  description: 'Histórico de Ficheros F1',
};

export default async function FicherosF1Page() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  if (['COMERCIAL', 'CANAL'].includes(userRole)) {
    redirect('/');
  }

  return <FicherosF1Client />;
}
