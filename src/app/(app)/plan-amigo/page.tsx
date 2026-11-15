import { redirect } from 'next/navigation';
import { getBrandAccessContext } from '@/lib/permissions';
import { getPlanAmigoDashboardDataAction } from '@/app/actions/referralActions';
import PlanAmigoClient from './PlanAmigoClient';

export default async function PlanAmigoPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}) {
  const access = await getBrandAccessContext();
  if (
    !access ||
    !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE', 'CLIENT'].includes(access.role)
  ) {
    redirect('/');
  }

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp?.page || '1', 10) || 1);
  const status = sp?.status || 'ALL';
  const search = sp?.search || '';

  const initialData = await getPlanAmigoDashboardDataAction({
    page,
    pageSize: 25,
    status,
    search,
  });

  return <PlanAmigoClient initialData={initialData as any} initialFilters={{ page, status, search }} />;
}
