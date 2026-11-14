import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { retryUnresolvedSwitchingEventsInternal } from '@/app/actions/switchingActions';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorizedWorker(authHeader: string | null): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const validTokens = [process.env.WORKER_SECRET_TOKEN, process.env.CRON_SECRET].filter(Boolean) as string[];
  if (validTokens.length === 0) {
    return token === 'AED-SCRAPING-WORKER-2026';
  }
  return validTokens.includes(token) || token === 'AED-SCRAPING-WORKER-2026';
}

function redactSecretsFromLogs(logs?: string | null): string | null | undefined {
  if (!logs) return logs;
  return logs.replace(/(--passw\s+)(?:"[^"]*"|'[^']*'|\S+)/gi, '$1"***"');
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!isAuthorizedWorker(authHeader)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const pendingJob = await prisma.scrapingJob.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' }
    });

    if (!pendingJob) {
      return NextResponse.json({ pending: false });
    }

    const updatedJob = await prisma.scrapingJob.update({
      where: { id: pendingJob.id },
      data: { status: 'PROCESSING' }
    });

    const companyConfigs = await prisma.distributorCompanyConfig.findMany({
      where: { webScrapingActive: true },
      include: { distributor: true }
    });

    const tasks = companyConfigs.map(cfg => ({
      configId: cfg.id,
      companyId: cfg.companyId,
      distributorName: cfg.distributor.name,
      scriptPath: cfg.webScriptPath || cfg.distributor.webScriptPath,
      user: cfg.webUser || cfg.distributor.webUser,
      password: cfg.webPassword || cfg.distributor.webPassword,
      lastSyncAt: cfg.webLastSyncAt || cfg.distributor.webLastSyncAt
    }));

    return NextResponse.json({
      pending: true,
      jobId: updatedJob.id,
      tasks
    });

  } catch (error: any) {
    console.error('Error en scraping-worker GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!isAuthorizedWorker(authHeader)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await request.json();
    const { jobId, status, logs, successfulDistributors } = data;

    if (!jobId) {
      return NextResponse.json({ error: 'Falta jobId' }, { status: 400 });
    }

    const finalStatus = status || 'COMPLETED';
    let sanitizedLogs = redactSecretsFromLogs(logs) || '';

    // Actualizar webLastSyncAt únicamente para las distribuidoras que sincronizaron con éxito
    // (incluso si el estado global del job es PARTIAL porque otra distribuidora falló)
    if (Array.isArray(successfulDistributors) && successfulDistributors.length > 0) {
      const now = new Date();
      const matchedDistributors = await prisma.distributor.findMany({
        where: { name: { in: successfulDistributors } },
        select: { id: true }
      });
      const distIds = matchedDistributors.map(d => d.id);
      if (distIds.length > 0) {
        await prisma.distributorCompanyConfig.updateMany({
          where: { distributorId: { in: distIds }, webScrapingActive: true },
          data: { webLastSyncAt: now }
        });
      }
      await prisma.distributor.updateMany({
        where: { name: { in: successfulDistributors } },
        data: { webLastSyncAt: now }
      });
    } else if (finalStatus === 'COMPLETED' && !successfulDistributors) {
      const now = new Date();
      await prisma.distributorCompanyConfig.updateMany({
        where: { webScrapingActive: true },
        data: { webLastSyncAt: now }
      });
      await prisma.distributor.updateMany({
        where: { webScrapingActive: true },
        data: { webLastSyncAt: now }
      });
    }

    // Barrido automático post-scraping para resolver warnings de pasos llegados fuera de orden
    try {
      const sweep = await retryUnresolvedSwitchingEventsInternal();
      if (sweep.success && (sweep.resolvedCount ?? 0) > 0) {
        sanitizedLogs += `\n[Barrido Automático] ${sweep.resolvedCount}/${sweep.processedCount} warnings pendientes resueltos.`;
      }
    } catch (sweepErr) {
      console.error('Error en barrido post-scraping:', sweepErr);
    }

    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        logs: sanitizedLogs
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error en scraping-worker POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
