import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cups = 'ES0031104831144001SS0F';
    const contracts = await prisma.contract.findMany({
      where: { supplyPoint: { cups } },
      include: { supplyPoint: true, client: true, product: true }
    });

    const results = contracts.map(b => {
      const airtable = (b.airtableData || {}) as any;
      return {
        id: b.id,
        tariff: b.supplyPoint?.tariff,
        vat: b.client?.vatNumber,
        cnae: b.supplyPoint?.cnae,
        airtable: {
          'INICIO_PERMANENCIA': airtable['INICIO_PERMANENCIA'],
          'BAJA COMERCIALIZADORA': airtable['BAJA COMERCIALIZADORA'],
          'Meses Permanencia': airtable['Meses Permanencia'],
          'CONSUMO COMISION': airtable['CONSUMO COMISION'],
          'PEN 2.0TD RESID': airtable['PEN 2.0TD RESID'],
          'PEN NO RESID': airtable['PEN NO RESID'],
          'PENALIZACIÓN CALC': airtable['PENALIZACIÓN CALC'],
          'P1E': airtable['P1E (from PRODUCTOS)']
        },
        erp: {
          activationDate: b.activationDate,
          permanenceStartDate: b.permanenceStartDate,
          terminationDate: b.terminationDate,
          annualConsumption: b.annualConsumption || b.supplyPoint?.annualConsumption,
          p1e: b.p1e
        }
      };
    });

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
