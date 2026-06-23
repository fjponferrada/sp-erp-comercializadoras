import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const sps = await prisma.supplyPoint.findMany({
    select: { id: true, cups: true, clientId: true }
  });

  const map = new Map();
  const duplicates = [];

  for (const sp of sps) {
    if (!sp.cups || sp.cups.length < 20) continue;
    const cups20 = sp.cups.substring(0, 20);
    const key = `${sp.clientId}_${cups20}`;

    if (map.has(key)) {
      duplicates.push({
        sp1: map.get(key),
        sp2: sp
      });
    } else {
      map.set(key, sp);
    }
  }

  return NextResponse.json({ totalDuplicates: duplicates.length, duplicates });
}
