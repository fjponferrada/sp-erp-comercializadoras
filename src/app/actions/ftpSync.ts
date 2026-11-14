'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';

const STALE_JOB_MS = 10 * 60 * 1000; // 10 minutes without update => stale

export async function triggerFtpSyncManually(daysBack?: number) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'Sesión no iniciada.' };
    }
    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      return { success: false, message: 'No tienes permisos para ejecutar la sincronización FTP.' };
    }

    const companyId = await resolveActiveCompanyId(session);
    if (!companyId) {
      return { success: false, message: 'No tienes una comercializadora activa asignada.' };
    }

    const configs = await prisma.distributorCompanyConfig.findMany({
      where: { companyId, ftpActive: true },
      select: { id: true }
    });

    if (configs.length === 0) {
      return { success: false, message: 'No hay configuraciones FTP activas para esta comercializadora.' };
    }

    // Limpiar jobs colgados antiguos (> 10 min sin actualizar) y reutilizar si ya hay uno activo
    const existingActiveJobs = await prisma.syncJob.findMany({
      where: {
        companyId,
        type: 'FTP_SYNC',
        status: { in: ['PENDING', 'RUNNING'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    const now = Date.now();
    for (const activeJob of existingActiveJobs) {
      if (now - activeJob.updatedAt.getTime() < STALE_JOB_MS) {
        return {
          success: true,
          alreadyRunning: true,
          message: 'Ya hay una sincronización FTP en curso para esta comercializadora.',
          jobId: activeJob.id
        };
      } else {
        await prisma.syncJob.update({
          where: { id: activeJob.id },
          data: { status: 'ERROR', logs: (activeJob.logs || '') + '\n[Timeout: Job expirado por inactividad]' }
        });
      }
    }

    const initialResults: Record<string, any> = {};
    if (daysBack && Number.isFinite(daysBack) && daysBack > 0) {
      const clampedDays = Math.min(Math.max(1, Math.floor(daysBack)), 365);
      const customSince = new Date(now - clampedDays * 24 * 60 * 60 * 1000);
      initialResults.__meta = { customSince: customSince.toISOString(), daysBack: clampedDays };
    }

    const job = await prisma.syncJob.create({
      data: {
        type: 'FTP_SYNC',
        status: 'PENDING',
        companyId,
        results: initialResults
      }
    });

    return {
      success: true,
      alreadyRunning: false,
      message: 'Sincronización FTP iniciada en segundo plano',
      jobId: job.id
    };
  } catch (error: any) {
    console.error('Error triggering FTP sync:', error);
    return { success: false, message: error.message || 'Error desconocido al sincronizar FTP' };
  }
}

export async function getDistributorSyncStatus() {
  try {
    const session = await auth();
    if (!session?.user || !hasAdminOrBackofficeRole((session.user as any).role)) {
      return [];
    }

    const companyId = await resolveActiveCompanyId(session);
    if (!companyId) return [];

    const configs = await prisma.distributorCompanyConfig.findMany({
      where: { companyId, ftpActive: true },
      include: {
        distributor: {
          select: { name: true }
        }
      },
      orderBy: {
        distributor: { name: 'asc' }
      }
    });

    return configs.map(c => ({
      name: c.distributor.name,
      ftpLastSyncAt: c.ftpLastSyncAt
    }));
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return [];
  }
}
