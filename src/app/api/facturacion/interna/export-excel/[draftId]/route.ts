import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import * as XLSX from 'xlsx';
import { InternalBillingEngine } from '@/lib/services/InternalBillingEngine';
import {
  formatMadridDateEs,
  formatMadridInclusiveEndEs,
} from '@/lib/services/internalInvoiceMapper';

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
        contract: { include: { supplyPoint: true, product: true } },
        supplyPoint: true,
      },
    });

    if (!draft || !draft.f1InvoiceId) {
      return new NextResponse('Draft or F1 not found', { status: 404 });
    }

    // Re-ejecutamos al vuelo solicitando el detalle cuarto-horario con auto-ajuste (forceRepair = true)
    const result = await InternalBillingEngine.calculate(draft.f1InvoiceId, true, true);
    const savedData = ((draft.invoiceData as Record<string, any>) || {});

    // Si la factura ya está EMITIDA o es ABONO, preservar los descuentos post-impuestos y el total exactos de su emisión
    // (ya que el saldo del monedero puede haberse consumido tras confirmar la factura)
    const isFinalized = draft.status === 'EMITIDA' || draft.status === 'ABONO';
    const effectiveBsUso = isFinalized
      ? Number(savedData.bolsilloSolarUso ?? savedData['Descuento Bolsillo Solar'] ?? result.bolsilloSolarUso ?? 0)
      : Number(result.bolsilloSolarUso ?? 0);
    const effectivePaUso = isFinalized
      ? Number(savedData.planAmigoUso ?? savedData['Descuento Plan Amigo'] ?? result.planAmigoUso ?? 0)
      : Number(result.planAmigoUso ?? 0);
    const effectiveTotalAmount = isFinalized
      ? Number(draft.totalAmount ?? result.totalAmount ?? 0)
      : Number(result.totalAmount ?? 0);

    const supplyPoint = draft.supplyPoint || draft.contract?.supplyPoint || draft.f1Invoice?.supplyPoint;
    const cups = supplyPoint?.cups || '';
    const airTarifa =
      (draft.contract?.airtableData as any)?.Tarifa ||
      (draft.contract?.airtableData as any)?.tarifa;
    const tariff =
      (Array.isArray(airTarifa) ? airTarifa[0] : airTarifa) ||
      draft.contract?.product?.tariff ||
      supplyPoint?.tariff ||
      '';

    const startDate = draft.f1Invoice?.fechaInicio || draft.billingStart;
    const endDate = draft.f1Invoice?.fechaFin || draft.billingEnd;
    const periodoStr = `${formatMadridDateEs(startDate)} - ${formatMadridInclusiveEndEs(startDate, endDate)}`;

    const wsData: any[][] = [];
    wsData.push(['CUPS', cups]);
    wsData.push(['Dirección de Suministro', supplyPoint?.address || '']);
    wsData.push(['Tarifa', tariff]);
    wsData.push(['Potencia Contratada P1 (kW)', draft.contract?.p1c ?? supplyPoint?.p1c ?? '']);
    wsData.push(['Periodo Facturación', periodoStr]);
    wsData.push(['Modelo de Precios', result.isFixed ? 'FIJO' : 'INDEXADO']);
    wsData.push([]);

    if (!result.hourlyDetails || result.hourlyDetails.length === 0) {
      wsData.push(['Nota', 'Esta factura no contiene curva cuarto-horaria (OtrasFacturas o sin consumo horario).']);
      wsData.push(['Base Imponible (€)', result.totalBase.toFixed(2)]);
      wsData.push(['Impuestos (€)', result.taxAmount.toFixed(2)]);
      if (effectiveBsUso !== 0) {
        wsData.push(['Descuento Bolsillo Solar (€)', (-Math.abs(effectiveBsUso)).toFixed(2)]);
      }
      if (effectivePaUso !== 0) {
        wsData.push(['Descuento Plan Amigo (€)', (-Math.abs(effectivePaUso)).toFixed(2)]);
      }
      wsData.push(['Total Factura (€)', effectiveTotalAmount.toFixed(2)]);
    } else {
      wsData.push([
        'Fecha',
        'Hora',
        'Periodo',
        'Consumo (kWh)',
        'OMIE (€/MWh)',
        'RT3 (€/MWh)',
        'RT6 (€/MWh)',
        'CT2 (€/MWh)',
        'CT3 (€/MWh)',
        'BS3 (€/MWh)',
        'RAD3 (€/MWh)',
        'RAD1X (€/MWh)',
        'BALX (€/MWh)',
        'EXD (€/MWh)',
        'IN7 (€/MWh)',
        'CFP (€/MWh)',
        'Pago OM (€/MWh)',
        'Pago OS (€/MWh)',
        'Capacidad (€/MWh)',
        'DSV (€/MWh)',
        'K',
        'Coef. BOE',
        'Pérdidas (%)',
        'Factor Pérdidas',
        'Mercado Base (€/MWh)',
        'FNEE (€/MWh)',
        'FEE (€/MWh)',
        'ATR (€/MWh)',
        'Precio Final Ph (€/MWh)',
        'Coste Total (€)',
        'Excedentes (kWh)',
        'PEXC (€/MWh)',
        'Pago Excedentes (€)',
      ]);

      let totalCch = 0;
      let totalMercado = 0;
      let totalSurplusKwh = 0;
      let totalSurplusPayout = 0;

      for (const h of result.hourlyDetails) {
        const dateObj = new Date(h.date);
        const madridIso = dateObj.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
        const fecha = dateObj.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
        const hora = madridIso.substring(11, 16);
        const kwh = (h.mwh || 0) * 1000;
        totalCch += kwh;
        totalMercado += h.hCost || 0;

        const omExtra = (h as any).rom || 0;
        const osExtra = (h as any).ros || 0;
        const pcCost = (h as any).pc || 0;
        const kVal = (h as any).k || 0;
        const pBoe = (h as any).perdBase || 0;

        const sumComps = (h as any).sumComps || 0;
        const compVals = (h as any).compVals || {};

        const baseMercado =
          ((h.omie || 0) + sumComps + omExtra + osExtra + pcCost + (h.dsv || 0)) *
          (h.lossFactor || 1);

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
          (h.omie || 0).toFixed(2),
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
          (h.dsv || 0).toFixed(2),
          kVal.toFixed(5),
          pBoe.toFixed(5),
          ((h.pctPerd || 0) * 100).toFixed(2) + '%',
          (h.lossFactor || 1).toFixed(4),
          baseMercado.toFixed(2),
          (h.fnee || 0).toFixed(2),
          (h.fee || 0).toFixed(2),
          (h.atr || 0).toFixed(2),
          (h.ph || 0).toFixed(2),
          (h.hCost || 0).toFixed(4),
          surplusKwh.toFixed(3),
          surplusPrice.toFixed(2),
          surplusPayout.toFixed(4),
        ]);
      }

      wsData.push([]);
      wsData.push(['TOTALES']);
      wsData.push(['Suma Consumo (kWh)', totalCch.toFixed(3)]);
      wsData.push(['Suma Coste Mercado / Energía (€)', totalMercado.toFixed(2)]);
      wsData.push(['Suma Excedentes (kWh)', totalSurplusKwh.toFixed(3)]);
      wsData.push(['Suma Pago Excedentes (€)', totalSurplusPayout.toFixed(2)]);
      wsData.push(['Base Imponible Factura (€)', result.totalBase.toFixed(2)]);
      wsData.push(['Impuestos Indirectos (€)', result.taxAmount.toFixed(2)]);
      if (effectiveBsUso !== 0) {
        wsData.push(['Descuento Bolsillo Solar (€)', (-Math.abs(effectiveBsUso)).toFixed(2)]);
      }
      if (effectivePaUso !== 0) {
        wsData.push(['Descuento Plan Amigo (€)', (-Math.abs(effectivePaUso)).toFixed(2)]);
      }
      wsData.push(['Total Factura (€)', effectiveTotalAmount.toFixed(2)]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Curva Horaria');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Desglose_Horario_${cups || draft.id.substring(0, 6)}_${draft.id.substring(0, 6)}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('Error generating excel:', err);
    return new NextResponse('Internal Error: ' + err.message, { status: 500 });
  }
}
