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
  const uiContracts = contracts.map(c => {
    const airtableData = (c.airtableData as any) || {};
    
    let signedUrl = null;
    if (airtableData['Contrato firmado'] && Array.isArray(airtableData['Contrato firmado']) && airtableData['Contrato firmado'].length > 0) {
      signedUrl = airtableData['Contrato firmado'][0].url;
    } else if (airtableData['Contrato .PDF'] && Array.isArray(airtableData['Contrato .PDF']) && airtableData['Contrato .PDF'].length > 0) {
      signedUrl = airtableData['Contrato .PDF'][0].url;
    }

    let draftUrl = null;
    if (airtableData['Borrador contrato'] && Array.isArray(airtableData['Borrador contrato']) && airtableData['Borrador contrato'].length > 0) {
      draftUrl = airtableData['Borrador contrato'][0].url;
    }

    return {
      ...c,
      lead: c.Lead,
      client: c.client,
      supplyPoint: c.supplyPoint,
      user: c.user,
      product: c.product,
      signedUrl,
      draftUrl
    };
  });

  return <ContractsClient contracts={uiContracts} userRole={userRole} />;
}
