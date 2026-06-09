import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import MarcasClient from './MarcasClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MarcasPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  const userRole = session.user.role;
  if (!['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'].includes(userRole as string)) {
    redirect('/'); // Oculto a comerciales
  }

  // Filtrado básico: SUPERADMIN ve todas. COMPANYADMIN y BACKOFFICE ven la de su empresa
  let whereClause = {};
  if (userRole !== 'SUPERADMIN') {
    const userWithBrand = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { brand: true }
    });
    if (userWithBrand && userWithBrand.brand) {
      whereClause = { companyId: userWithBrand.brand.companyId };
    }
  }

  const brands = await prisma.brand.findMany({
    where: whereClause,
    include: {
      company: {
        select: {
          name: true,
          cif: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  return <MarcasClient initialBrands={brands} />;
}
