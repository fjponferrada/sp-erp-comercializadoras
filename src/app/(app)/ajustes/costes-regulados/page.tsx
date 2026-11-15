import { redirect } from 'next/navigation';
import { getBrandAccessContext } from '@/lib/permissions';
import CostesReguladosClient from './CostesReguladosClient';

export default async function CostesReguladosPage() {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
    redirect('/');
  }

  return <CostesReguladosClient />;
}
