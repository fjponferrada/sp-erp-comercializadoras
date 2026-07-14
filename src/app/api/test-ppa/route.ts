import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const futures = await prisma.futurePrice.findMany({
    orderBy: { month: 'asc' }
  });
  return NextResponse.json(futures);
}
