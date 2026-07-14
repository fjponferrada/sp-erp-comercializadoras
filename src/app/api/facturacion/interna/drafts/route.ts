import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { draftIds } = body;

    if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
      return NextResponse.json({ message: 'draftIds is required' }, { status: 400 });
    }

    const deleted = await prisma.internalInvoice.deleteMany({
      where: {
        id: { in: draftIds },
        status: { in: ['BORRADOR', 'REQUIERE_REPARACION'] } // Solo permitimos borrar proformas
      }
    });

    return NextResponse.json({ success: true, count: deleted.count });
  } catch (error: any) {
    console.error('Error deleting internal invoices:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
