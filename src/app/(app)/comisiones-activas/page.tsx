import React from 'react';
import { redirect } from 'next/navigation';
import Topbar from '@/components/Topbar';
import ComisionesActivasClient from './ComisionesActivasClient';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand } from '@/lib/permissions';

export default async function ComisionesActivasPage() {
  const session = await auth();
  if (!session?.user || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(session.user.role)) {
    redirect('/');
  }

  const activeBrandId = await getActiveBrand();

  let channels: { id: string; name: string }[] = [];
  if (activeBrandId) {
    channels = await prisma.channel.findMany({
      where: { brandId: activeBrandId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Comisiones Activas"
        subtitle="Riesgo vivo y saldo pendiente de amortizar (horizonte anual de 365 días)"
      />

      <main className="flex-1 p-6 lg:p-8 w-full">
        <ComisionesActivasClient channels={channels} />
      </main>
    </div>
  );
}
