import { NextResponse } from 'next/server';
import * as fs from 'fs';
import { InternalBillingEngine } from '@/lib/services/InternalBillingEngine';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const providerCsvPath = 'Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv';
    const csvContent = fs.readFileSync(providerCsvPath, 'utf8');
    const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
    
    let providerEnergyCost = 0;
    let providerVol = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(';');
      if (parts.length < 10) continue;
      
      const lastCol = parts[parts.length - 1].replace(',', '.');
      const cost = parseFloat(lastCol);
      if (!isNaN(cost)) {
        providerEnergyCost += cost;
      }
      const kwh = parseFloat(parts[3].replace(',', '.'));
      if (!isNaN(kwh)) {
        providerVol += kwh;
      }
    }

    const f1 = await prisma.f1Invoice.findFirst({
      where: { contract: { supplyPoint: { cups: 'ES0031405446869086QD0F' } } },
      include: { contract: { include: { supplyPoint: true } } }
    });
    
    if (!f1) return NextResponse.json({ error: "no f1" });
    
    const res = await InternalBillingEngine.calculate(f1.id, true, true);
    
    const atrTotal = res.peajesDistribuidora + res.cargosDistribuidora;
    const ourMercado = res.energyCost - atrTotal;
    
    return NextResponse.json({
      provider: {
        costeMercadoTotal: providerEnergyCost,
        volumenKwh: providerVol
      },
      our: {
        totalBase: res.totalBase,
        totalEnergyCost: res.energyCost,
        atrTotal: atrTotal,
        costeMercadoTotal: ourMercado,
        volumenKwh: res.totalCchMWh * 1000
      }
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack });
  }
}
