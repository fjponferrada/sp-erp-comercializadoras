import React from 'react';
import { prisma } from '@/lib/prisma';
import Topbar from '@/components/Topbar';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import PerfilesReeClient from './PerfilesReeClient';

export const metadata = {
  title: 'Perfiles Iniciales de Consumo (REE) | SP Energía',
};

export default async function PerfilesReePage() {
  const session = await auth();
  if (!session) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user?.email || '' }
  });

  if (!user || (user.role !== 'SUPERADMIN' && user.role !== 'COMPANYADMIN' && user.role !== 'BACKOFFICE')) {
    redirect('/unauthorized');
  }

  // Fetch the summary of profiles in DB
  const distinctYears = await prisma.reeProfile.findMany({
    select: { year: true },
    distinct: ['year'],
    orderBy: { year: 'desc' }
  });

  // Count total records for each year
  const summaryByYear = await Promise.all(
    distinctYears.map(async (y) => {
      const count = await prisma.reeProfile.count({
        where: { year: y.year }
      });
      return {
        year: y.year,
        count
      };
    })
  );

  return (
    <div className="flex-1 bg-gray-50/50 min-h-screen">
      <Topbar title="Perfiles Iniciales de Consumo (REE)" />
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <PerfilesReeClient summary={summaryByYear} />
      </div>
    </div>
  );
}
