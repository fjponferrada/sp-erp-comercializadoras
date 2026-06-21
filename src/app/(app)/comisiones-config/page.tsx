import { prisma } from '@/lib/prisma';
import ComisionesClient from './ComisionesClient';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function ComisionesConfigPage() {
  const session = await auth();
  if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
    redirect('/');
  }

  const dbTiers = await prisma.commissionTier.findMany({
    include: {
      rules: { include: { products: { select: { id: true } }, additionalServices: { select: { id: true } } } },
      channels: { select: { id: true, name: true } }
    },
    orderBy: { name: 'asc' }
  });

  const products = await prisma.product.findMany({
    select: { id: true, name: true, type: true, tariff: true },
    orderBy: { name: 'asc' }
  });

  const services = await prisma.additionalService.findMany({
    select: { id: true, name: true },
    where: { isCommissionable: true },
    orderBy: { name: 'asc' }
  });

  return <ComisionesClient initialTiers={dbTiers} products={products} services={services} />;
}
