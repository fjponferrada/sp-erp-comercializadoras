import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export async function GET() {
  const renewals = await prisma.contract.findMany({
    where: {
      tipo: 'R',
      status: 'ACTIVO',
    }
  });

  let count = 0;
  for (const r of renewals) {
    if (r.activationDate) {
      await prisma.contract.update({
        where: { id: r.id },
        data: {
          permanenceStartDate: r.activationDate
        }
      });
      count++;
    }
  }

  return NextResponse.json({ success: true, fixed: count });
}
