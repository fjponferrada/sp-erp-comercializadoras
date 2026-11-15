import React from 'react';
import { prisma } from '@/lib/prisma';
import Topbar from '@/components/Topbar';
import { redirect } from 'next/navigation';
import { getBrandAccessContext } from '@/lib/permissions';
import PerfilesReeClient from './PerfilesReeClient';

export const metadata = {
  title: 'Perfiles Iniciales de Consumo (REE) | SP Energía',
};

export default async function PerfilesReePage() {
  const access = await getBrandAccessContext();
  if (!access) {
    redirect('/login');
  }

  if (!['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
    redirect('/');
  }

  const groupedByYear = await prisma.reeProfile.groupBy({
    by: ['year'],
    _count: { _all: true },
    orderBy: { year: 'desc' },
  });

  const summaryByYear = groupedByYear.map((g) => ({
    year: g.year,
    count: g._count._all,
  }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Perfiles Iniciales de Consumo (REE)"
        subtitle="Coeficientes horarios oficiales REE (2.0TD, 3.0TD, 3.0TDVE y Solar) para cotizador y predicción"
      />
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <PerfilesReeClient summary={summaryByYear} />
      </div>
    </div>
  );
}
