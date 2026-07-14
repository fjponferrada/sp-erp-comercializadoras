'use server';

import { cookies } from 'next/headers';
import { auth } from '@/auth';

export async function setActiveBrandAction(brandId: string) {
  const session = await auth();
  if (!session?.user) throw new Error('No autorizado');

  const { allowedBrands = [], brandId: primaryBrandId } = session.user as any;
  const isAllowed = allowedBrands.some((b: any) => b.id === brandId) || brandId === primaryBrandId;

  if (!isAllowed) {
    throw new Error('No tienes permisos para esta marca');
  }

  const cookieStore = await cookies();
  cookieStore.set('active-brand', brandId, { path: '/' });
}
