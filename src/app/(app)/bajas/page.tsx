import React from 'react';
import { prisma } from '@/lib/prisma';
import BajasClient from './BajasClient';
import { getPaginatedBajasAction, getBajasStatsAction } from '@/app/actions/bajasActions';

export default async function BajasPage() {
  const [bajasResult, statsResult, products] = await Promise.all([
    getPaginatedBajasAction(1, 100, '', 'TODOS'),
    getBajasStatsAction(),
    prisma.product.findMany({ orderBy: { name: 'asc' } })
  ]);

  return (
    <BajasClient 
      initialBajas={bajasResult.success ? (bajasResult.bajas || []) : []} 
      initialTotalCount={bajasResult.success ? (bajasResult.totalCount || 0) : 0}
      initialStats={statsResult.success ? statsResult.stats : { totalBajas: 0, bajasEsteMes: 0, totalMwhPerdido: 0, avgDias: 0, avgClientDias: 0 }}
      products={products} 
    />
  );
}
