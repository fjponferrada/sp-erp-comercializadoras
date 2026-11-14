import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveActiveCompanyId } from '@/lib/companyContext';
import { PricingEngine, PricingParams } from '@/lib/services/PricingEngine';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      tariff,
      margin,
      deviations,
      annualConsumptionKwh,
      sipsData,
      cchData,
      cchStartDate,
      startDate,
      durationMonths,
      riskLevel,
    } = body;

    if (!tariff || !startDate || margin == null || deviations == null) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios para la cotización' }, { status: 400 });
    }

    if (!annualConsumptionKwh && !sipsData && (!cchData || cchData.length === 0)) {
      return NextResponse.json(
        { error: 'Debes proporcionar consumo anual, datos SIPS o una curva CCH' },
        { status: 400 }
      );
    }

    const companyId = await resolveActiveCompanyId(session);

    const params: PricingParams = {
      tariff: String(tariff).trim().replace(/\s+/g, '').toUpperCase(),
      margin: Number(margin),
      deviations: Number(deviations),
      annualConsumptionKwh: annualConsumptionKwh ? Number(annualConsumptionKwh) : undefined,
      sipsData,
      cchData,
      cchStartDate: typeof cchStartDate === 'string' && cchStartDate ? cchStartDate : undefined,
      startDate,
      durationMonths: durationMonths ? Number(durationMonths) : 12,
      riskLevel: riskLevel ? Number(riskLevel) : 2,
      companyId,
    };

    const quote = await PricingEngine.generateQuote(params);

    return NextResponse.json(quote);
  } catch (error: any) {
    console.error('Pricing API Error:', error);
    return NextResponse.json({ error: error.message || 'Error generando cotización' }, { status: 500 });
  }
}
