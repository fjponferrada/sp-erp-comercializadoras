import React from 'react';
import { prisma } from '@/lib/prisma';
import RenovacionesClient from './RenovacionesClient';
import { getPaginatedRenovacionesAction, getRenovacionesStatsAction } from '@/app/actions/renovacionesActions';
import { getAuthorizedProductsWhereClause } from '@/app/actions/productActions';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function RenovacionesPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';
  if (!['COMERCIAL', 'CANAL', 'BACKOFFICE', 'SUPERADMIN', 'COMPANYADMIN'].includes(userRole as string)) {
    redirect('/');
  }

  const [renovacionesResult, statsResult, products, canales, additionalServices] = await Promise.all([
    getPaginatedRenovacionesAction(1, 100, '', 'TODAS', 'URGENTE', 'TODOS'),
    getRenovacionesStatsAction(),
    getAuthorizedProductsWhereClause().then(where => where ? prisma.product.findMany({ where, orderBy: { name: 'asc' } }) : []),
    prisma.channel.findMany({ orderBy: { name: 'asc' } }),
    prisma.additionalService.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  ]);

  console.log('BOE PRODUCTS:', products.filter(p => p.name.includes('BOE')).map(p => ({name: p.name, type: p.type, pm: p.pricingModel})));

  return (
    <RenovacionesClient 
      initialRenovaciones={renovacionesResult.success ? (renovacionesResult.renovaciones || []) : []} 
      initialTotalCount={renovacionesResult.success ? (renovacionesResult.totalCount || 0) : 0}
      initialStats={statsResult.success ? statsResult.stats : { totalEnCola: 0, urgentes: 0, proximos: 0, totalMwhRenovar: 0 }}
      products={products} 
      canales={canales}
      additionalServices={additionalServices}
    />
  );
}
