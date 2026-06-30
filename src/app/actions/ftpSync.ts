'use server';

import { executeFtpSync } from '@/app/api/cron/ftp-sync/route';
import { prisma } from '@/lib/prisma';

export async function triggerFtpSyncManually() {
  try {
    const configs = await prisma.distributor.findMany({
      where: { ftpActive: true }
    });

    if (configs.length === 0) {
      return { success: false, message: 'No hay configuraciones FTP activas.' };
    }

    // 1. Create the job in Prisma
    const job = await prisma.syncJob.create({
      data: {
        type: 'FTP_SYNC',
        status: 'PENDING'
      }
    });

    // Lanzamos la promesa y no la esperamos
    executeFtpSync(configs, job.id).catch(console.error);

    return { success: true, message: 'Sincronización FTP iniciada en segundo plano', jobId: job.id };
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
