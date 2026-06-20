import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || ['COMERCIAL', 'CANAL'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Buscar si ya hay un trabajo pendiente para no saturar
    const existingPending = await prisma.scrapingJob.findFirst({
      where: { status: 'PENDING' }
    });

    if (existingPending) {
      return NextResponse.json({ success: true, message: 'Ya hay un proceso de scraping en cola.', jobId: existingPending.id });
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
