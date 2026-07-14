import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { runCalculatePendingEnergy } from '@/scripts/calculate_pending_energy';

export async function POST(req: Request) {
  const session = await auth();
  if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runCalculatePendingEnergy((msg) => {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ msg })}\n\n`));
        }, session.user.companyId);
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (error: any) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
