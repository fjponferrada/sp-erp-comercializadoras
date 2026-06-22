import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const contracts = await prisma.contract.findMany({
      where: { contractCode: 'NUEB26331151QW0F' },
      orderBy: { version: 'asc' },
      include: { supplyPoint: true }
    });

    if (contracts.length < 2) {
      return NextResponse.json({ success: false, error: 'Not enough versions' });
    }

    const v0 = contracts[0];
    const latest = contracts[contracts.length - 1];

    if (!latest.supplyPoint.annualConsumption && v0.supplyPoint.annualConsumption) {
      await prisma.supplyPoint.update({
        where: { id: latest.supplyPointId },
        data: {
          annualConsumption: v0.supplyPoint.annualConsumption
        }
      });
      return NextResponse.json({ success: true, message: `Fixed consumption for NUEB26331151QW0F. Old consumption was ${v0.supplyPoint.annualConsumption}` });
    }

    return NextResponse.json({ success: true, message: `No fix needed. Latest consumption: ${latest.supplyPoint.annualConsumption}, Old: ${v0.supplyPoint.annualConsumption}` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
