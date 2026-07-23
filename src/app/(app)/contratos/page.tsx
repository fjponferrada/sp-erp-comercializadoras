import { auth } from '@/auth';
import { getContractStatsAction, getPaginatedContractsAction } from '@/app/actions/contractActions';
import ContractsClient from './ContractsClient';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ContratosPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  const [statsResult, contractsResult, channelsResult, tiposResult] = await Promise.all([
    getContractStatsAction(),
    getPaginatedContractsAction(1, 100, '', 'Todos', 'Todas', 'Todos', 'Todos', 'fechaRegistro', 'desc'),
    prisma.channel.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.contract.findMany({ select: { tipo: true }, distinct: ['tipo'], where: { tipo: { not: null } } })
  ]);

  const stats = statsResult.success ? statsResult : { activos: 0, tramitando: 0, bajas: 0, totalMwh: 0 };
  const initialContracts = contractsResult.success ? contractsResult.contracts : [];
  const initialTotalCount = contractsResult.success ? contractsResult.totalCount : 0;
  const initialChannels = channelsResult.map(c => c.name);
  const initialTipos = tiposResult.map(t => t.tipo).filter(Boolean).sort((a, b) => (a as string).localeCompare(b as string));

  return (
    <ContractsClient 
      initialContracts={initialContracts as any} 
      initialTotalCount={initialTotalCount as number}
      stats={stats as any}
      userRole={userRole} 
      initialChannels={initialChannels}
      initialTipos={initialTipos as string[]}
    />
  );
}
