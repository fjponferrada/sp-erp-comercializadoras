import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import { runCalculatePendingEnergy } from '@/scripts/calculate_pending_energy';

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!session || !hasAdminOrBackofficeRole(role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let activeCompanyId = await resolveActiveCompanyId(session);
  if (!activeCompanyId && role === 'SUPERADMIN') {
    const firstComp = await prisma.company.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
    activeCompanyId = firstComp?.id || null;
  }

  let body: { rebuildAggregates?: boolean; targetMonths?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // Petición sin body JSON (comportamiento por defecto)
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runCalculatePendingEnergy(
          (msg) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ msg })}\n\n`));
          },
          activeCompanyId || undefined,
          {
            rebuildAggregates: Boolean(body?.rebuildAggregates),
            targetMonths: Array.isArray(body?.targetMonths) ? body.targetMonths : undefined,
          }
        );
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: error?.message || 'Error desconocido' })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
