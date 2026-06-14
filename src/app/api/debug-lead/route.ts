import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' });
  }

  const lead = await prisma.lead.findFirst({
    where: { id: { contains: id, mode: 'insensitive' } },
  });

  return NextResponse.json(lead);
}
