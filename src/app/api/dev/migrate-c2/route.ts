import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const res = await prisma.systemComponentPrice.updateMany({
      where: { version: null },
      data: { version: 'C2' }
    });
    return NextResponse.json({ success: true, count: res.count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
