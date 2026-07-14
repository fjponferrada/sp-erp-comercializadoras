import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const baseCups = 'ES0031101445366001GN';
  const sps = await prisma.supplyPoint.findMany({
    where: { cups: { startsWith: baseCups } },
    include: { contracts: true }
  });
  
  return NextResponse.json(sps);
}
