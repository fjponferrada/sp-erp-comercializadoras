'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { BrandTheme } from '@/context/BrandThemeContext';

export async function updateBrandThemeAction(brandId: string, themeData: Partial<BrandTheme>) {
  const session = await auth();
  if (!session?.user) throw new Error('No autorizado');

  const { allowedBrands = [], brandId: primaryBrandId, role } = session.user as any;
  const isAllowed = role === 'SUPERADMIN' || allowedBrands.some((b: any) => b.id === brandId) || brandId === primaryBrandId;

  if (!isAllowed) {
    throw new Error('No tienes permisos para editar esta marca');
  }

  // Actualizamos el Brand en la BD
  await prisma.brand.update({
    where: { id: brandId },
    data: {
      name: themeData.name,
      accentColor: themeData.accentColor,
      bgColor: themeData.bgColor,
      surfaceColor: themeData.surfaceColor,
      borderColor: themeData.borderColor,
      logoUrl: themeData.logoUrl,
      faviconUrl: themeData.faviconUrl,
      domain: (themeData as any).domain,
    }
  });

  return { success: true };
}
