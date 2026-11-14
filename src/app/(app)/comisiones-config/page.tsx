import { prisma } from '@/lib/prisma';
import ComisionesClient from './ComisionesClient';
import { auth } from '@/auth';
import { getActiveBrand } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export default async function ComisionesConfigPage() {
  const session = await auth();
  if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
    redirect('/');
  }

  const activeBrandId = await getActiveBrand();
  const brandWhere = activeBrandId ? { brandId: activeBrandId } : {};

  const [dbTiers, products, services] = await Promise.all([
    prisma.commissionTier.findMany({
      where: brandWhere,
      include: {
        rules: {
          include: {
            products: { select: { id: true } },
            additionalServices: { select: { id: true } },
          },
        },
        channels: {
          where: brandWhere,
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: brandWhere,
      select: { id: true, name: true, type: true, tariff: true },
      orderBy: { name: 'asc' },
    }),
    prisma.additionalService.findMany({
      where: { isCommissionable: true, ...brandWhere },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <ComisionesClient initialTiers={dbTiers} products={products} services={services} />;
}
