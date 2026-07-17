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

    // Fetch the drafts
    const drafts = await prisma.internalInvoice.findMany({
      where: { id: { in: draftIds } },
      include: {
        f1Invoice: {
          include: {
            contract: true,
            supplyPoint: true
          }
        },
        contract: true
      }
    });

    const updatedDrafts = [];

    for (const draft of drafts) {
      if (!draft.f1InvoiceId || !draft.f1Invoice || !draft.f1Invoice.contract || !draft.f1Invoice.supplyPointId) {
        continue;
      }
      
      const f1 = draft.f1Invoice;
      const contract = draft.f1Invoice.contract;

      try {
        // Ejecuta el cálculo forzando la reparación de la CCH si fuera necesario
        const result = await InternalBillingEngine.calculate(f1.id, true);
        
        const updated = await prisma.internalInvoice.update({
          where: { id: draft.id },
          data: {
            status: result.hasMismatch ? 'REQUIERE_REPARACION' : 'BORRADOR',
            repairData: result.repairData,
            subtotal1: result.totalBase,
            taxAmount: result.taxAmount,
            totalAmount: result.totalAmount,
            totalMWh: result.totalCchMWh,
            margin: result.feeCost,
            invoiceData: {
              repaired: !!result.repairData,
              repairedAt: result.repairData ? new Date().toISOString() : undefined,
              pricingModel: contract.pricingModel || 'INDEXADO',
              feeApplied: contract.fee,
              assumedConsumption: result.totalCchMWh,
              energyCost: result.energyCost,
              capacityCost: result.capacityCost,
              fneeCost: result.fneeCost,
              powerCost: result.powerCost,
              peajesDistribuidora: result.peajesDistribuidora,
              cargosDistribuidora: result.cargosDistribuidora,
              alquilerEquipo: result.alquilerEquipo,
              bonoSocial: result.bonoSocial,
              bonoSocialLabel: result.bonoSocialLabel,
              taxElectric: result.taxElectric,
              excesosPotencia: result.excesosPotencia,
              excedentesAutoconsumo: result.excedentesAutoconsumo,
              excedentesKwh: result.excedentesKwh,
              maxExcedentes: result.maxExcedentes,
              bolsilloSolarLlenado: result.bolsilloSolarLlenado,
              powerDetails: result.powerDetails,
              energyAtrDetails: result.energyAtrDetails,
              energyMarketDetails: result.energyMarketDetails,
              f1Readings: result.f1Readings,
              periods: result.periods,
              reactiveEnergyCost: result.reactiveEnergyCost,
              reactiveDetails: result.reactiveDetails,
              svaCost: result.svaCost,
              svaConcept: result.svaConcept,
              pexc: result.pexc,
              energyMargin: result.energyMargin,
              powerMargin: result.powerMargin
            } as any
          }
        });
        updatedDrafts.push(updated);
      } catch (err: any) {
        console.error("Error recalculando borrador", draft.id, err);
        const errorUpdated = await prisma.internalInvoice.update({
          where: { id: draft.id },
          data: {
            status: 'REQUIERE_REPARACION',
            repairData: { issue: err.message || "Error fatal desconocido al recalcular" },
            subtotal1: 0,
            taxAmount: 0,
            totalAmount: 0,
            totalMWh: 0,
            margin: 0,
            invoiceData: {}
          }
        });
        updatedDrafts.push(errorUpdated);
      }
    }

    return NextResponse.json({ success: true, count: updatedDrafts.length });
  } catch (error: any) {
    console.error("Error in recalculate:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
