'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cookies } from 'next/headers';

export async function getAuthorizedProductsWhereClause() {
  const session = await auth();
  if (!session?.user) return null;

  const sessionUser = session.user as any;
  const user = sessionUser.id
    ? await prisma.user.findUnique({ where: { id: sessionUser.id } })
    : await prisma.user.findFirst({
        where: { email: { equals: (sessionUser.email || '').trim(), mode: 'insensitive' } },
      });

  if (!user || user.isActive === false || user.role === 'CLIENT') return null;

  const cookieStore = await cookies();
  const cookieBrandId = cookieStore.get('active-brand')?.value;
  const allowedBrands = Array.isArray(sessionUser.allowedBrands) ? sessionUser.allowedBrands : [];
  const activeBrandId =
    cookieBrandId && (user.role === 'SUPERADMIN' || allowedBrands.some((b: any) => b.id === cookieBrandId))
      ? cookieBrandId
      : user.brandId;

  if (!activeBrandId) return null;

  const whereClause: any = {
    brandId: activeBrandId,
  };

  if (['CANAL', 'COMERCIAL'].includes(user.role)) {
    whereClause.isAvailableCrm = true;
    if (user.channelId) {
      whereClause.channels = {
        some: { id: user.channelId },
      };
    }
  }

  return whereClause;
}

export async function getAvailableProducts() {
  try {
    const whereClause = await getAuthorizedProductsWhereClause();
    if (!whereClause) {
      return { success: false, error: 'No autorizado o sin marca' };
    }

    const products = await prisma.product.findMany({
      where: {
        ...whereClause,
        isAvailableCrm: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        tariff: true,
        hasSelfConsumption: true,
        isCustomizable: true,
        pricingModel: true,
      },
      orderBy: { name: 'asc' },
    });

    return { success: true, data: products };
  } catch (error: any) {
    console.error('Error fetching available products:', error);
    return { success: false, error: 'Error interno del servidor' };
  }
}
