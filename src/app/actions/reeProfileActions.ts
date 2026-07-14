'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function uploadReeProfilesAction(year: number, profiles: any[]) {
  const session = await auth();
  if (!session) {
    throw new Error('No autorizado');
  }

  // Verificar si el usuario tiene permisos (solo admins)
  const user = await prisma.user.findUnique({
    where: { email: session.user?.email || '' }
  });

  if (!user || (user.role !== 'SUPERADMIN' && user.role !== 'COMPANYADMIN')) {
    throw new Error('Permisos insuficientes para cargar perfiles REE');
  }

  try {
    // 1. Eliminar los perfiles del año para evitar duplicados
    await prisma.reeProfile.deleteMany({
      where: { year }
    });

    // 2. Insertar los nuevos perfiles en lotes (batch)
    // profiles format: { year, month, day, hour, p20td, p30td, p30tdve }
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize);
      const dataToInsert = batch.map(p => ({
        year: p.year,
        month: p.month,
        day: p.day,
        hour: p.hour,
        p20td: p.p20td,
        p30td: p.p30td,
        p30tdve: p.p30tdve !== undefined ? p.p30tdve : null,
        pSolar: p.pSolar !== undefined ? p.pSolar : 0,
      }));

      await prisma.reeProfile.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });

      inserted += batch.length;
    }

    return { success: true, count: inserted };
  } catch (error: any) {
    console.error('Error uploading REE profiles:', error);
    return { success: false, error: error.message || 'Error desconocido' };
  }
}
