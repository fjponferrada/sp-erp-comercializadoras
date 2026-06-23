import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const c = await prisma.client.findFirst({ where: { vatNumber: '30205968E' } });
  return NextResponse.json(c);
}
