import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const data = await prisma.reganecuData.findFirst({
    where: { total: true },
    orderBy: { date: 'desc' }
  });
  return NextResponse.json(data);
}
