import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const date = new Date('2026-06-01T00:00:00Z');
    const priceData = await prisma.systemComponentPrice.findMany({
      where: { date: date }
    });

    const res: any = {};
    for (const pd of priceData) {
      if (['OMIE', 'OS', 'RESTRICCIONES', 'K', 'PERD_30TD'].includes(pd.component)) {
        res[pd.component] = pd.values[0];
      }
    }
    
    // Also fetch the contract to check its deviation cost and fee
    const contract = await prisma.contract.findFirst({
       where: { supplyPoint: { cups: 'ES0031405446869086QD0F' } }
    });
    res['deviationCost'] = contract?.deviationCost;
    res['fee'] = contract?.fee;

    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
