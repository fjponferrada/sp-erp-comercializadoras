import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { hasAdminOrBackofficeRole } from '@/lib/companyContext';
import { getActiveBrand } from '@/lib/permissions';
import FianzasClient from './FianzasClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Fianzas y Otras Facturas F1 | SP Energía ERP',
  description: 'Listado de fianzas, derechos y compensaciones importados mediante ficheros F1 (OtrasFacturas)',
};

export default async function FianzasPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  if (!hasAdminOrBackofficeRole(session.user.role)) {
    redirect('/');
  }

  const activeBrandId = await getActiveBrand();

  return <FianzasClient activeBrandId={activeBrandId} />;
}
