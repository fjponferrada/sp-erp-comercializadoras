import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import BajasClient from './BajasClient';
import { getPaginatedBajasAction } from '@/app/actions/bajasActions';
import { getAuthorizedProductsWhereClause } from '@/app/actions/productActions';
import { getChannelVisibilityFilter, getUserVisibilityFilter } from '@/lib/permissions';
import { hasAdminOrBackofficeRole } from '@/lib/companyContext';

export const dynamic = 'force-dynamic';

const BASE_TARIFA_OPTIONS = [
  '2.0TD',
  '3.0TD',
  '3.0TDVE',
  '6.1TD',
  '6.1TDVE',
  '6.2TD',
  '6.3TD',
  '6.4TD',
];

export default async function BajasPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'CANAL';
  if (!['COMERCIAL', 'CANAL', 'BACKOFFICE', 'SUPERADMIN', 'COMPANYADMIN'].includes(userRole)) {
    redirect('/');
  }

  const visibilityFilter = await getUserVisibilityFilter();

  const [bajasResult, products, channels, distinctOrigenesResult, distinctTariffsResult] =
    await Promise.all([
      getPaginatedBajasAction(1, 100, '', 'TODOS', 'TODOS', []),
      getAuthorizedProductsWhereClause().then((where) =>
        where ? prisma.product.findMany({ where, orderBy: { name: 'asc' } }) : []
      ),
      getChannelVisibilityFilter().then((where) =>
        prisma.channel.findMany({ where, orderBy: { name: 'asc' } })
      ),
      prisma.contract.findMany({
        where: {
          ...visibilityFilter,
          status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] },
        },
        select: { bajaProcess: true },
        distinct: ['bajaProcess'],
      }),
      prisma.contract.findMany({
        where: {
          ...visibilityFilter,
          status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] },
        },
        select: { supplyPoint: { select: { tariff: true } } },
        distinct: ['supplyPointId'],
        take: 2000,
      }),
    ]);

  const origenBajaOptions = Array.from(
    new Set(
      distinctOrigenesResult
        .map((o) => o.bajaProcess)
        .filter(Boolean)
        .map((o) => String(o).trim())
    )
  ).sort();
  if (!origenBajaOptions.includes('Sin origen')) {
    origenBajaOptions.push('Sin origen');
  }

  const dynamicTariffs = new Set<string>(BASE_TARIFA_OPTIONS);
  let hasEmptyTariff = false;
  for (const row of distinctTariffsResult) {
    const t = (row.supplyPoint?.tariff || '').trim();
    if (t) dynamicTariffs.add(t);
    else hasEmptyTariff = true;
  }
  const tarifaOptions = Array.from(dynamicTariffs).sort();
  if (hasEmptyTariff) tarifaOptions.push('Sin tarifa');

  return (
    <BajasClient
      userRole={userRole}
      isBackofficeOrAdmin={
        bajasResult.success
          ? Boolean(bajasResult.isBackofficeOrAdmin)
          : hasAdminOrBackofficeRole(userRole)
      }
      initialBajas={bajasResult.success ? bajasResult.bajas || [] : []}
      initialTotalCount={bajasResult.success ? bajasResult.totalCount || 0 : 0}
      initialConfirmadasCount={bajasResult.success ? bajasResult.confirmadasCount || 0 : 0}
      initialPreavisoCount={bajasResult.success ? bajasResult.preavisoCount || 0 : 0}
      initialTotalPenaltySum={bajasResult.success ? bajasResult.totalPenaltySum || 0 : 0}
      initialStats={
        bajasResult.success && bajasResult.stats
          ? bajasResult.stats
          : {
              totalBajas: 0,
              bajasEsteMes: 0,
              totalMwhPerdido: 0,
              avgDias: 0,
              avgClientDias: 0,
              totalPenaltySum: 0,
              pendingPenaltyCount: 0,
            }
      }
      products={products}
      channels={channels}
      origenBajaOptions={origenBajaOptions}
      tarifaOptions={tarifaOptions}
    />
  );
}
