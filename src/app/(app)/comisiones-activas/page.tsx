import React from 'react';
import Topbar from '@/components/Topbar';
import ComisionesActivasClient from './ComisionesActivasClient';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cookies } from 'next/headers';

export default async function ComisionesActivasPage() {
  const session = await auth();
  const cookieStore = await cookies();
  const activeBrandId = cookieStore.get('active-brand')?.value || (session?.user as any)?.brandId;
  
  let channels: { id: string, name: string }[] = [];
  if (activeBrandId) {
    channels = await prisma.channel.findMany({
      where: { brandId: activeBrandId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Comisiones Activas" subtitle="Gestión y liquidación de comisiones de la red de ventas" />
      
      <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <ComisionesActivasClient channels={channels} />
      </main>
    </div>
  );
}
