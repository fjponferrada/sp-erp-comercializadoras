import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InternalBillingEngine } from '@/lib/services/InternalBillingEngine';

export async function GET() {
  try {
    const draft = await prisma.internalInvoice.findFirst({
      where: { contract: { supplyPoint: { cups: 'ES0031405446869086QD0F' } } }
    });
    
    if (!draft || !draft.f1InvoiceId) {
      return NextResponse.json({ success: false, error: 'Draft or F1 not found' }, { status: 404 });
    }
    
    const result = await InternalBillingEngine.calculate(draft.f1InvoiceId, false, true);
    
    let sumOmie = 0, sumOs = 0, sumRest = 0;
    
    if (result.hourlyDetails) {
      for (const h of result.hourlyDetails) {
      if (h.mwh > 0) {
        sumOmie += h.omie * h.mwh * h.lossFactor;
        sumOs += h.os * h.mwh * h.lossFactor;
        sumRest += h.rest * h.mwh * h.lossFactor;
      }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      sumOmie, sumOs, sumRest, energyCost: result.energyCost
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack });
  }
}
