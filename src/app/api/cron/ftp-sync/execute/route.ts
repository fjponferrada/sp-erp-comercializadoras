import { NextResponse } from 'next/server';
import { executeFtpSync, loadActiveFtpConfigs } from '@/app/api/cron/ftp-sync/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';

export const maxDuration = 300; // Hasta 5 mins en Vercel Pro / ejecución local

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  const isCronAuthorized =
    Boolean(expectedSecret) &&
    (secret === expectedSecret || authHeader === `Bearer ${expectedSecret}`);

  let session: any = null;
  let role: string | undefined;

  if (!isCronAuthorized) {
    session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    role = (session.user as any).role as string | undefined;
    if (!hasAdminOrBackofficeRole(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const jobId = url.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  const job = await prisma.syncJob.findUnique({ where: { id: jobId } });
  if (!job || !job.companyId) {
    return NextResponse.json({ error: 'Job no válido o sin compañía asignada' }, { status: 400 });
  }

  if (!isCronAuthorized && role !== 'SUPERADMIN') {
    const activeCompanyId = await resolveActiveCompanyId(session);
    const userCompanyId = (session.user as any).companyId;
    if (job.companyId !== activeCompanyId && job.companyId !== userCompanyId) {
      return NextResponse.json({ error: 'Forbidden: Job belongs to another company' }, { status: 403 });
    }
  }

  const configs = await loadActiveFtpConfigs(job.companyId);
  if (configs.length === 0) {
    await prisma.syncJob.update({
      where: { id: jobId },
      data: { status: 'ERROR', logs: 'No hay configuraciones FTP activas para esta comercializadora.' }
    }).catch(() => {});
    return NextResponse.json({ error: 'No configs' }, { status: 400 });
  }

  try {
    const { hasMore } = await executeFtpSync(configs, jobId, req.url);
    return NextResponse.json({ success: true, hasMore });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
