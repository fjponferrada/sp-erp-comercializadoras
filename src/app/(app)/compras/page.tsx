import ComprasDashboard from '@/components/compras/ComprasDashboard';
import { prisma } from '@/lib/prisma';
import { get12MonthProjectionAction } from '@/app/actions/portfolioProjectionActions';

export default async function ComprasPage() {
  // Fetch initial data for the dashboard to render server-side
  const recentForecasts = await prisma.demandForecast.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  const activeContracts = await prisma.contract.count({
    where: { status: 'ACTIVO' }
  });

  const lastModelCache = await prisma.forecastModelCache.findFirst({
    select: { updatedAt: true }
  });

  const projectionResult = await get12MonthProjectionAction();
  const projectionData = projectionResult.success ? projectionResult.data : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <ComprasDashboard 
        initialForecasts={recentForecasts} 
        activeContracts={activeContracts} 
        lastTrainingDate={lastModelCache?.updatedAt}
        projectionData={projectionData}
      />
    </div>
  );
}
