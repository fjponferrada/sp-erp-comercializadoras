import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InternalBillingEngine } from '@/lib/services/InternalBillingEngine';

export async function GET() {
  try {
    const f1 = await prisma.f1Invoice.findFirst({
      where: { contract: { supplyPoint: { cups: 'ES0031405446869086QD0F' } } }
    });
    
    if (!f1) return NextResponse.json({ error: "no f1" });

    const result = await InternalBillingEngine.calculate(f1.id, true, true);
    
    const h = result.hourlyDetails?.[0]; // first hour
    const totalEnergy = result.energyCost;
    const omieArr = await prisma.systemComponentPrice.findFirst({
      where: { date: new Date('2026-06-01T00:00:00Z'), component: 'OMIE' }
    });
    
    return NextResponse.json({
      totalEnergy,
      powerCost: result.powerCost,
      omieArr,
      h0: h
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack });
  }
}
