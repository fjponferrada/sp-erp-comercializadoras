import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole } from '@/lib/companyContext';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    const isCron =
      Boolean(expectedSecret) &&
      (secret === expectedSecret || authHeader === `Bearer ${expectedSecret}`);

    if (!isCron) {
      const session = await auth();
      if (!session?.user || !hasAdminOrBackofficeRole((session.user as any).role)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    // Auto-recuperación: Si hay trabajos en PENDING o PROCESSING con más de 30 minutos, marcarlos como FAILED
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    await prisma.scrapingJob.updateMany({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
        createdAt: { lt: thirtyMinutesAgo }
      },
      data: {
        status: 'FAILED',
        logs: 'Timeout automático (más de 30 minutos sin finalizar por el worker local).'
      }
    });

    // Evitar encolar duplicados si ya hay un trabajo PENDING o en ejecución (PROCESSING)
    const existingActive = await prisma.scrapingJob.findFirst({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      orderBy: { createdAt: 'desc' }
    });

    if (existingActive) {
      return NextResponse.json({
        success: true,
        message: existingActive.status === 'PROCESSING'
          ? 'Ya hay un proceso de scraping ejecutándose en este momento.'
          : 'Ya hay un proceso de scraping en cola.',
        jobId: existingActive.id
      });
    }

    // Crear un nuevo trabajo de scraping
    const newJob = await prisma.scrapingJob.create({
      data: {
        status: 'PENDING',
        logs: 'Trabajo encolado. Esperando que el Worker local lo recoja...'
      }
    });

    return NextResponse.json({ success: true, message: 'Scraping encolado correctamente.', jobId: newJob.id });

  } catch (error: any) {
    console.error('Error trigger-scraping:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
