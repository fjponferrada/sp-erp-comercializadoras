import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any).role as string | undefined;
    if (!hasAdminOrBackofficeRole(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const job = await prisma.syncJob.findUnique({
      where: { id }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (role !== 'SUPERADMIN') {
      const activeCompanyId = await resolveActiveCompanyId(session);
      const userCompanyId = (session.user as any).companyId;
      if (!job.companyId || (job.companyId !== activeCompanyId && job.companyId !== userCompanyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Sanitize large internal arrays (pendingFiles) before sending over polling HTTP response
    let cleanResults: Record<string, any> | null = null;
    if (job.results && typeof job.results === 'object' && !Array.isArray(job.results)) {
      cleanResults = {};
      for (const [key, val] of Object.entries(job.results as Record<string, any>)) {
        if (key === '__meta') continue;
        if (val && typeof val === 'object') {
          const { pendingFiles, ...rest } = val;
          cleanResults[key] = {
            ...rest,
            remainingFiles: Array.isArray(pendingFiles) ? pendingFiles.length : 0
          };
        }
      }
    }

    return NextResponse.json({
      ...job,
      results: cleanResults
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
