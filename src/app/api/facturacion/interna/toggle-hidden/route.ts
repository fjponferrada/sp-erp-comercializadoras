import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { draftId, hidden } = body;

    if (!draftId) {
      return NextResponse.json({ message: 'draftId is required' }, { status: 400 });
    }

    const updated = await prisma.internalInvoice.update({
      where: { id: draftId },
      data: { hidden }
    });

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    console.error('Error toggling internal invoice hidden state:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
