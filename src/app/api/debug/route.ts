import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export async function GET() {
  const c1 = await prisma.contract.findFirst({
    where: { contractCode: 'PRPR26424941RG0F' }
  });
  const prev = await prisma.contract.findFirst({
    where: { id: c1?.previousContractId || '' }
  });

  return NextResponse.json({
    status: c1?.status,
    tipo: c1?.tipo,
    previousId: c1?.previousContractId,
    prevContractCode: prev?.contractCode,
    prevExpectedEndDate: prev?.expectedEndDate
  });
}
