import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserVisibilityFilter } from '@/lib/permissions';
import ContractsClient from './ContractsClient';

export const dynamic = 'force-dynamic';

export default async function ContratosPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';
  const visibilityFilter = await getUserVisibilityFilter();

  const contracts = await prisma.contract.findMany({
    where: visibilityFilter,
    include: {
      Lead: true,
      product: { select: { name: true } },
      user: { select: { name: true, email: true, channel: { select: { name: true } } } },
      client: true,
      supplyPoint: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Remap uppercase relations to lowercase for the UI component
  const uiContracts = contracts.map(c => ({
    ...c,
    lead: c.Lead,
    client: c.client,
    supplyPoint: c.supplyPoint,
    user: c.user,
    product: c.product
  }));

  return <ContractsClient contracts={uiContracts} userRole={userRole} />;
}
