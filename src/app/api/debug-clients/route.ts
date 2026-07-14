import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const clients = await prisma.client.findMany({
    where: { id: { in: ['cmq75em8s00087s417vix1c5s', 'cmqi686mu00b6zs417zcv80sl'] } }
  });
  return NextResponse.json(clients);
}
