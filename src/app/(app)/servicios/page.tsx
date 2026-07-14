import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import ServiciosClient from './ServiciosClient';
import Topbar from '@/components/Topbar';

export default async function ServiciosPage() {
  const session = await auth();
  if (!session || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes((session.user as any)?.role)) {
    return <div className="p-8 text-center text-red-500">No autorizado</div>;
  }

  const cookieStore = await cookies();
  const activeBrandId = cookieStore.get('active-brand')?.value;
  const targetBrandId = (activeBrandId && activeBrandId !== 'todas') ? activeBrandId : (session.user as any)?.brandId;

  const servicios = targetBrandId ? await prisma.additionalService.findMany({
    where: { brandId: targetBrandId },
    orderBy: { name: 'asc' }
  }) : [];

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Servicios Adicionales" subtitle="Gestión de servicios opcionales para la marca" />
      <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <ServiciosClient initialServicios={servicios} />
      </main>
    </div>
  );
}
