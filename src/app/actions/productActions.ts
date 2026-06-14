'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function getAvailableProducts() {
  try {
    const session = await auth();
    if (!session) {
      return { success: false, error: 'No autorizado' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string }
    });

    if (!user || !user.brandId) {
      return { success: false, error: 'Usuario no encontrado o sin marca asignada' };
    }


    const whereClause: any = {
      brandId: user.brandId,
      isAvailableCrm: true
    };

    if (['CANAL', 'COMERCIAL'].includes(user.role) && user.channelId) {
      whereClause.channels = {
        some: { id: user.channelId }
      };
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
