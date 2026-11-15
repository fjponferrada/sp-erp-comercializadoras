import { redirect } from 'next/navigation';
import { resolveDashboardAccess } from '@/lib/dashboardAccess';
import { getDashboardMetricsAction } from '@/app/actions/dashboardActions';
import { getEconomicAnalysis } from '@/app/actions/analysisActions';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const access = await resolveDashboardAccess();

  if (!access.isLoggedIn) {
    redirect('/login');
  }

  if (access.role === 'CLIENT' || access.role === 'CLIENTE') {
    redirect('/facturas');
  }

  if (!access.isAuthorized) {
    redirect('/clientes');
  }

  const [metricsRes, analysisData] = await Promise.all([
    getDashboardMetricsAction(),
    getEconomicAnalysis(),
  ]);

  return (
    <DashboardClient
      initialMetrics={metricsRes.success ? metricsRes.data : null}
      initialError={metricsRes.success ? null : metricsRes.error}
      initialAnalysisData={analysisData}
    />
  );
}
