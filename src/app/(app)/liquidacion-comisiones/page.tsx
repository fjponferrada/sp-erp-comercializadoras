import React from 'react';
import { redirect } from 'next/navigation';
import Topbar from '@/components/Topbar';
import LiquidacionComisionesClient from './LiquidacionComisionesClient';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand } from '@/lib/permissions';

export default async function LiquidacionComisionesPage() {
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
      <Topbar title="Liquidación Comisiones" subtitle="Cálculo del importe a liquidar por canal y periodo mensual" />

      <main className="flex-1 p-6 lg:p-8 w-full">
        <LiquidacionComisionesClient channels={channels} />
      </main>
    </div>
  );
}
