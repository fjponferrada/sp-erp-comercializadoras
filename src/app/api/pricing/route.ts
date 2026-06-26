import { NextResponse } from 'next/server';
import { PricingEngine, PricingParams } from '@/lib/services/PricingEngine';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tariff, margin, deviations, annualConsumptionKwh, sipsData, cchData, startDate, durationMonths, riskLevel } = body;

    if (!tariff || !startDate || margin == null || deviations == null) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    if (!annualConsumptionKwh && !sipsData && (!cchData || cchData.length === 0)) {
      return NextResponse.json({ error: 'Debes proporcionar consumo anual, datos SIPS o una curva CCH' }, { status: 400 });
    }

    const params: PricingParams = {
      tariff,
      margin: Number(margin),
      deviations: Number(deviations),
      annualConsumptionKwh: annualConsumptionKwh ? Number(annualConsumptionKwh) : undefined,
      sipsData, // {p1, p2, p3, p4, p5, p6}
      cchData,
      startDate,
      durationMonths: durationMonths ? Number(durationMonths) : 12,
      riskLevel: riskLevel ? Number(riskLevel) : 2
    };

    const quote = await PricingEngine.generateQuote(params);

    return NextResponse.json(quote);
  } catch (error: any) {
    console.error('Pricing API Error:', error);
    return NextResponse.json({ error: error.message || 'Error generating quote' }, { status: 500 });
  }
}
