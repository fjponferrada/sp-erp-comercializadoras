import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { InternalBillingEngine } from '@/lib/services/InternalBillingEngine';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { f1Ids } = body;

    if (!f1Ids || !Array.isArray(f1Ids) || f1Ids.length === 0) {
      return NextResponse.json({ message: 'f1Ids is required' }, { status: 400 });
    }

    // Fetch the F1s with contracts
    const f1s = await prisma.f1Invoice.findMany({
      where: { id: { in: f1Ids } },
      include: {
        contract: true,
        supplyPoint: true
      }
    });

    const createdDrafts = [];

    for (const f1 of f1s) {
      if (!f1.contractId || !f1.contract || !f1.supplyPointId) {
        continue;
      }
      
      const contract = f1.contract;

      try {
        const result = await InternalBillingEngine.calculate(f1.id, false);
        
        const draft = await prisma.internalInvoice.create({
          data: {
            status: result.hasMismatch ? 'REQUIERE_REPARACION' : 'BORRADOR',
            repairData: result.repairData,
            invoiceType: 'NORMAL',
            clientId: contract.clientId,
            contractId: contract.id,
            supplyPointId: contract.supplyPointId,
            f1InvoiceId: f1.id,
            issueDate: new Date(),
            subtotal1: result.totalBase,
            taxPercentage: 21,
            taxAmount: result.taxAmount,
            totalAmount: result.totalAmount,
            totalMWh: result.totalCchMWh,
            margin: result.feeCost,
            billingStart: f1.fechaInicio || new Date(),
            billingEnd: f1.fechaFin || new Date(),
            origin: 'INTERNAL_ENGINE',
            invoiceData: {
              pricingModel: contract.pricingModel || 'INDEXADO',
              feeApplied: contract.fee,
              assumedConsumption: result.totalCchMWh,
              energyCost: result.energyCost,
              capacityCost: result.capacityCost,
              fneeCost: result.fneeCost,
              powerCost: result.powerCost,
              peajesDistribuidora: result.peajesDistribuidora,
              cargosDistribuidora: result.cargosDistribuidora,
              periods: result.periods
            }
          }
        });
        createdDrafts.push(draft);
      } catch (err) {
        console.error("Error calculando F1", f1.id, err);
      }
    }

    return NextResponse.json({ success: true, count: createdDrafts.length });
  } catch (error: any) {
    console.error('Error calculating internal invoices:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
