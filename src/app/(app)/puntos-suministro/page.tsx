import React from 'react';
import { getPaginatedSupplyPointsAction } from '@/app/actions/supplyPointActions';
import SupplyPointsClient from './SupplyPointsClient';
import { auth } from '@/auth';

export default async function SupplyPointsPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  const result = await getPaginatedSupplyPointsAction(1, 100, '');

  const initialSupplyPoints = result.success ? result.supplyPoints : [];
  const initialTotalCount = result.success ? result.totalCount : 0;

  return (
    <SupplyPointsClient 
      initialSupplyPoints={initialSupplyPoints as any} 
      initialTotalCount={initialTotalCount as number}
      userRole={userRole} 
    />
  );
}
