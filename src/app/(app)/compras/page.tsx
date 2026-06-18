import ComprasDashboard from '@/components/compras/ComprasDashboard';
import { prisma } from '@/lib/prisma';

export default async function ComprasPage() {
  // Fetch initial data for the dashboard to render server-side
  const recentForecasts = await prisma.demandForecast.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  const activeContracts = await prisma.contract.count({
    where: { status: 'ACTIVO' }
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <ComprasDashboard 
        initialForecasts={recentForecasts} 
        activeContracts={activeContracts} 
      />
    </div>
  );
}
