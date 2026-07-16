import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const code = 'NUEB26222146HT0F';
  const contracts = await prisma.contract.findMany({
    where: { contractCode: code },
    orderBy: { version: 'asc' },
    include: {
      supplyPoint: true,
      product: true,
    }
  });

  const events = await prisma.switchingEvent.findMany({
    where: { supplyPointId: contracts[0]?.supplyPointId },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  return NextResponse.json({ contracts, events });
}
