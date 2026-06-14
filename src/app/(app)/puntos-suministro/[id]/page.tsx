import React from 'react';
import { getSupplyPointDetailsAction } from '@/app/actions/supplyPointActions';
import SupplyPointDetailClient from './SupplyPointDetailClient';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function SupplyPointDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  const result = await getSupplyPointDetailsAction(id);

  if (!result.success || !result.supplyPoint) {
    redirect('/puntos-suministro');
  }

  return (
    <SupplyPointDetailClient 
      initialSupplyPoint={result.supplyPoint as any} 
      userRole={userRole} 
    />
  );
}
