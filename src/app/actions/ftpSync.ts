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
    const req = new NextRequest(`http://localhost/api/cron/ftp-sync?secret=${process.env.CRON_SECRET}&jobId=${job.id}`);
    const res = await GET(req);
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al conectar con el FTP');
    }
    
    // Devolvemos la respuesta que contiene el jobId
    return await res.json();
  } catch (error: any) {
    console.error("Error triggering FTP sync:", error);
    throw new Error(error.message || "Error desconocido al sincronizar FTP");
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
