import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const WORKER_TOKEN = process.env.WORKER_SECRET_TOKEN || 'AED-SCRAPING-WORKER-2026';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${WORKER_TOKEN}`) {
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

    const distributors = await prisma.distributor.findMany({
      where: { webScrapingActive: true }
    });

    const tasks = distributors.map(d => ({
      distributorName: d.name,
      scriptPath: d.webScriptPath,
      user: d.webUser,
      password: d.webPassword
    }));

    return NextResponse.json({
      pending: true,
      jobId: updatedJob.id,
      tasks: tasks
    });

  } catch (error: any) {
    console.error('Error en scraping-worker GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${WORKER_TOKEN}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await request.json();
    const { jobId, status, logs } = data;

    if (!jobId) {
      return NextResponse.json({ error: 'Falta jobId' }, { status: 400 });
    }

    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: status || 'COMPLETED',
        logs: logs
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error en scraping-worker POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
