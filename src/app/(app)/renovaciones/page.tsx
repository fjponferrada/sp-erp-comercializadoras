import React from 'react';
import { prisma } from '@/lib/prisma';
import RenovacionesClient from './RenovacionesClient';
import { getPaginatedRenovacionesAction, getRenovacionesStatsAction } from '@/app/actions/renovacionesActions';

export default async function RenovacionesPage() {
  const [renovacionesResult, statsResult, products] = await Promise.all([
    getPaginatedRenovacionesAction(1, 100, '', 'TODAS', 'TODOS'),
    getRenovacionesStatsAction(),
    prisma.product.findMany({ orderBy: { name: 'asc' } })
  ]);

  return (
    <RenovacionesClient 
      initialRenovaciones={renovacionesResult.success ? (renovacionesResult.renovaciones || []) : []} 
      initialTotalCount={renovacionesResult.success ? (renovacionesResult.totalCount || 0) : 0}
      initialStats={statsResult.success ? statsResult.stats : { totalEnCola: 0, urgentes: 0, proximos: 0, totalMwhRenovar: 0 }}
      products={products} 
    />
  );
}
