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

  // Filtrado multi-empresa: SUPERADMIN ve todas; COMPANYADMIN y BACKOFFICE ven sus comercializadoras autorizadas
  let whereClause: Record<string, any> = {};
  if (userRole !== 'SUPERADMIN') {
    const userRecord = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        brand: { select: { companyId: true } },
        companies: { select: { id: true } },
        assignedBrands: { select: { companyId: true } },
      },
    });
    const allowedCompanyIds = Array.from(
      new Set(
        [
          userRecord?.brand?.companyId,
          ...(userRecord?.companies || []).map((c) => c.id),
          ...(userRecord?.assignedBrands || []).map((b) => b.companyId),
        ].filter(Boolean) as string[]
      )
    );
    whereClause = { id: { in: allowedCompanyIds } };
  }

  const companies = await prisma.company.findMany({
    where: whereClause,
    orderBy: { name: 'asc' },
  });

  return <ComercializadorasClient initialCompanies={companies} />;
}
