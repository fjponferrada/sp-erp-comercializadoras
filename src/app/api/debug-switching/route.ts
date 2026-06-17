import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const distributors = await prisma.distributor.findMany();
  
  const events = await prisma.switchingEvent.findMany({
    select: {
      procesoBase: true,
      paso: true,
    },
    distinct: ['procesoBase', 'paso'],
  });

  return NextResponse.json({ distributors, events });
}
