import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (!session?.user || role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden: SUPERADMIN required' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (Array.isArray(body?.invoiceIds) && body.invoiceIds.length > 0) {
    const res = await prisma.invoice.updateMany({
      where: { id: { in: body.invoiceIds } },
      data: { communicatedAt: null }
    });
    return NextResponse.json({ success: true, count: res.count, message: `Cleared communicatedAt on ${res.count} invoices` });
  }

  if (body?.confirm !== 'CLEAR_ALL_COMMUNICATED') {
    return NextResponse.json(
      { error: 'Confirmation token required (confirm: "CLEAR_ALL_COMMUNICATED" or invoiceIds[])' },
      { status: 400 }
    );
  }

  const res = await prisma.invoice.updateMany({ data: { communicatedAt: null } });
  return NextResponse.json({ success: true, count: res.count, message: 'Cleared communicatedAt flags' });
}
