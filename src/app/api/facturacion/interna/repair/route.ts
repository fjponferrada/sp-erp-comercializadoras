import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { InternalBillingEngine } from '@/lib/services/InternalBillingEngine';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { draftIds } = body;

    if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
      return NextResponse.json({ message: 'draftIds is required' }, { status: 400 });
    }

    const draftsToRepair = await prisma.internalInvoice.findMany({
      where: { 
        id: { in: draftIds },
        status: 'REQUIERE_REPARACION'
      },
      include: {
        contract: true,
        f1Invoice: true
      }
    });

    const repairedInvoices = [];

    for (const draft of draftsToRepair) {
      const contract = draft.contract!;
      const f1 = draft.f1Invoice!;

      try {
        const result = await InternalBillingEngine.calculate(f1.id, true); // forceRepair = true

        const updated = await prisma.internalInvoice.update({
          where: { id: draft.id },
          data: {
            status: 'BORRADOR',
            subtotal1: result.totalBase,
            taxAmount: result.taxAmount,
            totalAmount: result.totalAmount,
            totalMWh: result.totalF1MWh, // El volumen reparado coincide con el del F1
            margin: result.feeCost,
            invoiceData: {
              ...(draft.invoiceData ? (draft.invoiceData as object) : {}),
              repaired: true,
              repairedAt: new Date().toISOString(),
              energyCost: result.energyCost,
              capacityCost: result.capacityCost,
              fneeCost: result.fneeCost,
              powerCost: result.powerCost,
              peajesDistribuidora: result.peajesDistribuidora,
              cargosDistribuidora: result.cargosDistribuidora,
              periods: result.periods
            } as any
          }
        });

        repairedInvoices.push(updated);
      } catch (err) {
        console.error("Error repairing draft", draft.id, err);
      }
    }

    return NextResponse.json({ success: true, count: repairedInvoices.length });
  } catch (error: any) {
    console.error('Error repairing internal invoices:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
