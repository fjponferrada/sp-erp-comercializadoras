import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import * as XLSX from 'xlsx';
import { InternalBillingEngine } from '@/lib/services/InternalBillingEngine';

export async function GET(req: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { draftId } = await params;
    const draft = await prisma.internalInvoice.findUnique({
      where: { id: draftId },
      include: {
        f1Invoice: { include: { contract: true, supplyPoint: true } },
        contract: { include: { supplyPoint: true } },
      }
    });

    if (!draft || !draft.f1InvoiceId) {
      return new NextResponse('Draft or F1 not found', { status: 404 });
    }

    // Re-run the engine on the fly, requesting hourly details, without forcing repair
    const result = await InternalBillingEngine.calculate(draft.f1InvoiceId, false, true);
    
    if (!result.hourlyDetails || result.hourlyDetails.length === 0) {
      return new NextResponse('No hourly data available', { status: 400 });
    }

    const wsData = [];
    wsData.push(['CUPS', draft.contract?.supplyPoint?.cups || '']);
    wsData.push(['Tarifa', draft.contract?.supplyPoint?.tariff || '']);
    wsData.push(['Periodo', `${draft.f1Invoice?.fechaInicio?.toISOString().split('T')[0]} - ${draft.f1Invoice?.fechaFin?.toISOString().split('T')[0]}`]);
    wsData.push([]);
    
    wsData.push([
      'Fecha', 'Hora', 'Periodo', 'Consumo (kWh)', 
      'OMIE (€/MWh)', 
      'RT3 (€/MWh)', 'RT6 (€/MWh)', 'CT2 (€/MWh)', 'CT3 (€/MWh)', 'BS3 (€/MWh)', 
      'RAD3 (€/MWh)', 'RAD1X (€/MWh)', 'BALX (€/MWh)', 'EXD (€/MWh)', 'IN7 (€/MWh)', 'CFP (€/MWh)',
      'Pago OM (€/MWh)', 'Pago OS (€/MWh)', 'Capacidad (€/MWh)', 'DSV (€/MWh)', 
      'K', 'Coef. BOE', 'Pérdidas (%)', 'Factor Pérdidas',
      'Mercado Base (€/MWh)', 'FNEE (€/MWh)', 'FEE (€/MWh)', 'ATR (€/MWh)',
      'Precio Final Ph (€/MWh)', 'Coste Total (€)',
      'Excedentes (kWh)', 'PEXC (€/MWh)', 'Pago Excedentes (€)'
    ]);

    let totalCch = 0;
    let totalMercado = 0;
    let totalSurplusKwh = 0;
    let totalSurplusPayout = 0;

    for (const h of result.hourlyDetails) {
      const dateObj = new Date(h.date);
      const fecha = dateObj.toLocaleDateString('es-ES');
      const hora = dateObj.getHours().toString().padStart(2, '0') + ':' + dateObj.getMinutes().toString().padStart(2, '0');
      const kwh = h.mwh * 1000;
      totalCch += kwh;
      totalMercado += h.hCost;

      const omExtra = (h as any).rom || 0;
      const osExtra = (h as any).ros || 0;
      const pcCost = (h as any).pc || 0;
      const kVal = (h as any).k || 0;
      const pBoe = (h as any).perdBase || 0;
      
      const sumComps = (h as any).sumComps || 0;
      const compVals = (h as any).compVals || {};
      
      const baseMercado = (h.omie + sumComps + omExtra + osExtra + pcCost + h.dsv) * h.lossFactor;

      const surplusMwh = (h as any).surplusMwh || 0;
      const surplusPrice = (h as any).surplusPrice || 0;
      const surplusPayout = (h as any).surplusPayout || 0;
      const surplusKwh = surplusMwh * 1000;
      totalSurplusKwh += surplusKwh;
      totalSurplusPayout += surplusPayout;

      wsData.push([
        fecha,
        hora,
        h.period,
        kwh.toFixed(3),
        h.omie.toFixed(2),
        (compVals['RT3'] || 0).toFixed(2),
        (compVals['RT6'] || 0).toFixed(2),
        (compVals['CT2'] || 0).toFixed(2),
        (compVals['CT3'] || 0).toFixed(2),
        (compVals['BS3'] || 0).toFixed(2),
        (compVals['RAD3'] || 0).toFixed(2),
        (compVals['RAD1X'] || 0).toFixed(2),
        (compVals['BALX'] || 0).toFixed(2),
        (compVals['EXD'] || 0).toFixed(2),
        (compVals['IN7'] || 0).toFixed(2),
        (compVals['CFP'] || 0).toFixed(2),
        omExtra.toFixed(2),
        osExtra.toFixed(2),
        pcCost.toFixed(2),
        h.dsv.toFixed(2),
        kVal.toFixed(5),
        pBoe.toFixed(5),
        (h.pctPerd * 100).toFixed(2) + '%',
        h.lossFactor.toFixed(4),
        baseMercado.toFixed(2),
        h.fnee.toFixed(2),
        h.fee.toFixed(2),
        h.atr.toFixed(2),
        h.ph.toFixed(2),
        h.hCost.toFixed(4),
        surplusKwh.toFixed(3),
        surplusPrice.toFixed(2),
        surplusPayout.toFixed(4)
      ]);
    }

    wsData.push([]);
    wsData.push(['TOTALES']);
    wsData.push(['Suma Consumo (kWh)', totalCch.toFixed(3)]);
    wsData.push(['Suma Coste Mercado (€)', totalMercado.toFixed(2)]);
    wsData.push(['Suma Excedentes (kWh)', totalSurplusKwh.toFixed(3)]);
    wsData.push(['Suma Pago Excedentes (€)', totalSurplusPayout.toFixed(2)]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Curva Horaria');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Desglose_Horario_${draft.contract?.supplyPoint?.cups}_${draft.id.substring(0,6)}.xlsx"`
      }
    });

  } catch (err: any) {
    console.error("Error generating excel:", err);
    return new NextResponse('Internal Error: ' + err.message, { status: 500 });
  }
}
