import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const c = await prisma.contract.findFirst({
      where: { contractCode: 'PRJAV26210193FJ0F' },
      orderBy: { createdAt: 'desc' }
    });
    if (c) {
      await prisma.contract.update({
        where: { id: c.id },
        data: { tipoC2: 'S' }
      });
      return NextResponse.json({ success: true, message: 'Updated to S' });
    }
    return NextResponse.json({ success: false, message: 'Not found' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
