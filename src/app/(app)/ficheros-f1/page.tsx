import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { hasAdminOrBackofficeRole } from '@/lib/companyContext';
import { getActiveBrand } from '@/lib/permissions';
import FicherosF1Client from './FicherosF1Client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Listado de Facturas F1 | SP Energía ERP',
  description: 'Histórico y auditoría de ficheros de facturación F1 de distribuidora',
};

export default async function FicherosF1Page() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  if (!hasAdminOrBackofficeRole(session.user.role)) {
    redirect('/');
  }

  const activeBrandId = await getActiveBrand();

  return <FicherosF1Client activeBrandId={activeBrandId} />;
}
