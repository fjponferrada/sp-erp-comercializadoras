'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function getAuthorizedProductsWhereClause() {
  const session = await auth();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email as string }
  });

  if (!user || !user.brandId) return null;

  const whereClause: any = {
    brandId: user.brandId,
    isAvailableCrm: true
  };

  if (['CANAL', 'COMERCIAL'].includes(user.role) && user.channelId) {
    whereClause.channels = {
      some: { id: user.channelId }
    };
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
      where: whereClause,
      select: {
        id: true,
        name: true,
        type: true,
        tariff: true,
        hasSelfConsumption: true,
        isCustomizable: true,
        pricingModel: true,
      },
      orderBy: { name: 'asc' }
    });

    return { success: true, data: products };
  } catch (error: any) {
    console.error('Error fetching available products:', error);
    return { success: false, error: 'Error interno del servidor' };
  }
}
