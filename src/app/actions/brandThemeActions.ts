'use server';

import { prisma } from '@/lib/prisma';
import { BrandTheme } from '@/context/BrandThemeContext';
import { getBrandAccessContext } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

export async function updateBrandThemeAction(brandId: string, themeData: Partial<BrandTheme>) {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
    throw new Error('No autorizado');
  }

  if (!brandId || !access.canAccessBrand(brandId)) {
    throw new Error('No tienes permisos para editar esta marca');
  }

  const cleanName = typeof themeData.name === 'string' ? themeData.name.trim() : undefined;
  const rawDomain = (themeData as any).domain;
  const cleanDomain =
    rawDomain === null || rawDomain === ''
      ? null
      : typeof rawDomain === 'string'
        ? rawDomain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '') || null
        : undefined;

  await prisma.brand.update({
    where: { id: brandId },
    data: {
      ...(cleanName ? { name: cleanName } : {}),
      accentColor: themeData.accentColor,
      bgColor: themeData.bgColor,
      surfaceColor: themeData.surfaceColor,
      borderColor: themeData.borderColor,
      logoUrl: themeData.logoUrl ?? null,
      ...(themeData.faviconUrl !== undefined ? { faviconUrl: themeData.faviconUrl } : {}),
      ...(cleanDomain !== undefined ? { domain: cleanDomain } : {}),
    },
  });

  revalidatePath('/', 'layout');
  revalidatePath('/ajustes');

  return { success: true };
}
