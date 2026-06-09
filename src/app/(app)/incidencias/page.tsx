import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import IncidenciasClient from './IncidenciasClient';

export default async function IncidenciasPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  if (session.user.role === 'CANAL') {
    redirect('/'); // Oculto a comerciales
  }

  // Filtrado de marcas permitidas
  let brandWhereClause: any = {};
  if (session.user.role !== 'SUPERADMIN' && session.user.role !== 'CLIENT') {
    const userWithBrand = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { brand: true }
    });
    if (userWithBrand && userWithBrand.brand) {
      brandWhereClause.id = userWithBrand.brand.id;
    }
  }

  const userBrands = await prisma.brand.findMany({
    where: brandWhereClause,
    orderBy: { name: 'asc' }
  });

  return <IncidenciasClient userBrands={userBrands} />;
}
