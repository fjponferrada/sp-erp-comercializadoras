import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import ComercializadorasClient from './ComercializadorasClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ComercializadorasPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  const userRole = session.user.role;
  if (!['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'].includes(userRole as string)) {
    redirect('/'); // Oculto a comerciales
  }

  // Filtrado básico: SUPERADMIN ve todas. COMPANYADMIN y BACKOFFICE ven la(s) de su marca/company
  let whereClause = {};
  if (userRole !== 'SUPERADMIN') {
    // Buscar la empresa del usuario basándonos en su brand
    const userWithBrand = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { brand: true }
    });
    if (userWithBrand && userWithBrand.brand) {
      whereClause = { id: userWithBrand.brand.companyId };
    }
  }

  const companies = await prisma.company.findMany({
    where: whereClause,
    orderBy: { name: 'asc' }
  });
  console.log("NEXTJS DATABASE URL IS:", process.env.DATABASE_URL);
  console.log("COMPANIES FOUND IN NEXTJS:", JSON.stringify(companies, null, 2));

  return <ComercializadorasClient initialCompanies={companies} />;
}
