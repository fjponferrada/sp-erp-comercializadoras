import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole } from '@/lib/companyContext';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const job = await prisma.scrapingJob.findUnique({
      where: { id }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const safeLogs = job.logs
      ? job.logs.replace(/(--passw\s+)(?:"[^"]*"|'[^']*'|\S+)/gi, '$1"***"')
      : job.logs;

    return NextResponse.json({ ...job, logs: safeLogs });
  } catch (error: any) {
    console.error('Error fetching scraping job:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
