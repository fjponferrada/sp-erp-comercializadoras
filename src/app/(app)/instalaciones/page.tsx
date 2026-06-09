import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import InstalacionesClient, { InstalacionData } from './InstalacionesClient';

export const dynamic = 'force-dynamic';

export default async function InstalacionesPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  // TODO: Add proper visibility filter for users if needed. 
  // Currently assuming SUPERADMIN/BACKOFFICE sees all, CANAL sees those associated with their clients
  // For simplicity and speed in this demo, let's fetch all and we can refine later based on the user's needs.

  const dbSupplyPoints = await prisma.supplyPoint.findMany({
    include: {
      client: true,
      contracts: {
        include: { product: true }
      }
    },
    orderBy: {
      cups: 'asc'
    }
  });

  const instalacionesData: InstalacionData[] = dbSupplyPoints.map(sp => {
    // Find the currently active contract if any
    const activeContract = sp.contracts.find(c => c.status === 'ACTIVO') || sp.contracts.find(c => c.status === 'RENOVACION_TRAMITADA') || null;

    return {
      id: sp.id,
      cups: sp.cups,
      address: sp.address,
      city: sp.city,
      province: sp.province,
      tariff: sp.tariff,
      isActive: !!activeContract,
      clientName: sp.client.businessName || `${sp.client.firstName || ''} ${sp.client.lastName || ''}`.trim() || 'Desconocido',
      clientId: sp.client.id,
      activeContractId: activeContract?.id || null,
      productName: activeContract?.product?.name || '-'
    };
  });

  return (
    <InstalacionesClient 
      instalaciones={instalacionesData} 
      userRole={userRole} 
    />
  );
}
