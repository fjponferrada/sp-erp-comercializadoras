'use server';

import { GET } from '@/app/api/cron/ftp-sync/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function triggerFtpSyncManually() {
  try {
    // 1. Create the job in Prisma
    const job = await prisma.syncJob.create({
      data: {
        type: 'FTP_SYNC',
        status: 'PENDING'
      }
    });

    // 2. Simulamos la request para pasar el middleware del endpoint, pasando el jobId
    // Si CRON_SECRET no está definido, usamos un fallback vacío para que coincidan (ambos undefined o vacíos)
    const secret = process.env.CRON_SECRET || 'fallback_secret';
    const req = new NextRequest(`http://localhost/api/cron/ftp-sync?secret=${secret}&jobId=${job.id}`);
    const res = await GET(req);
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, message: err.error || 'Error al conectar con el FTP' };
    }
    
    // Devolvemos la respuesta que contiene el jobId
    return await res.json();
  } catch (error: any) {
    console.error("Error triggering FTP sync:", error);
    return { success: false, message: error.message || "Error desconocido al sincronizar FTP" };
  }
}

export async function getDistributorSyncStatus() {
  try {
    const configs = await prisma.distributor.findMany({
      where: { ftpActive: true },
      select: { name: true, ftpLastSyncAt: true }
    });
    return configs;
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return [];
  }
}
