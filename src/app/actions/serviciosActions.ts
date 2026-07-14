'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

async function getAdminBrandId() {
  const session = await auth();
  if (!session || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes((session.user as any)?.role)) {
    return null;
  }
  const cookieStore = await cookies();
  const activeBrandId = cookieStore.get('active-brand')?.value;
  return (activeBrandId && activeBrandId !== 'todas') ? activeBrandId : (session.user as any)?.brandId;
}

export async function createServicioAction(data: { name: string; monthlyPrice: number; dailyPrice: number; isCommissionable: boolean }) {
  try {
    const brandId = await getAdminBrandId();
    if (!brandId) return { success: false, error: 'No autorizado o sin marca activa' };

    const newSvc = await prisma.additionalService.create({
      data: {
        name: data.name,
        monthlyPrice: data.monthlyPrice,
        dailyPrice: data.dailyPrice,
        isCommissionable: data.isCommissionable,
        isActive: true,
        brandId: brandId
      }
    });
    revalidatePath('/servicios');
    return { success: true, data: newSvc };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: 'Error al crear servicio' };
  }
}

export async function updateServicioAction(id: string, data: { name: string; monthlyPrice: number; dailyPrice: number; isCommissionable: boolean }) {
  try {
    const brandId = await getAdminBrandId();
    if (!brandId) return { success: false, error: 'No autorizado' };

    const svc = await prisma.additionalService.findUnique({ where: { id } });
    if (!svc || svc.brandId !== brandId) {
      return { success: false, error: 'Servicio no encontrado' };
    }

    const updated = await prisma.additionalService.update({
      where: { id },
      data: {
        name: data.name,
        monthlyPrice: data.monthlyPrice,
        dailyPrice: data.dailyPrice,
        isCommissionable: data.isCommissionable
      }
    });
    revalidatePath('/servicios');
    return { success: true, data: updated };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: 'Error al actualizar servicio' };
  }
}

export async function toggleServicioStatusAction(id: string, isActive: boolean) {
  try {
    const brandId = await getAdminBrandId();
    if (!brandId) return { success: false, error: 'No autorizado' };

    const svc = await prisma.additionalService.findUnique({ where: { id } });
    if (!svc || svc.brandId !== brandId) {
      return { success: false, error: 'Servicio no encontrado' };
    }

    await prisma.additionalService.update({
      where: { id },
      data: { isActive }
    });
    revalidatePath('/servicios');
    return { success: true };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: 'Error al cambiar estado' };
  }
}
