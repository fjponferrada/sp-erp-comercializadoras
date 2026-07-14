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
        // Ejecuta el cálculo forzando la reparación de la CCH si fuera necesario
        const result = await InternalBillingEngine.calculate(f1.id, true);
        
        const draft = await prisma.internalInvoice.create({
          data: {
            status: 'BORRADOR',
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
            totalMWh: result.totalF1MWh, // Usamos F1 porque al reparar coincide
            margin: result.feeCost,
            billingStart: f1.fechaInicio || new Date(),
            billingEnd: f1.fechaFin || new Date(),
            origin: 'INTERNAL_ENGINE',
            invoiceData: {
              repaired: !!result.repairData,
              repairedAt: result.repairData ? new Date().toISOString() : undefined,
              pricingModel: contract.pricingModel || 'INDEXADO',
              feeApplied: contract.fee,
              assumedConsumption: result.totalF1MWh,
              energyCost: result.energyCost,
              capacityCost: result.capacityCost,
              fneeCost: result.fneeCost,
              powerCost: result.powerCost,
              peajesDistribuidora: result.peajesDistribuidora,
              cargosDistribuidora: result.cargosDistribuidora,
              alquilerEquipo: result.alquilerEquipo,
              bonoSocial: result.bonoSocial,
              taxElectric: result.taxElectric,
              excesosPotencia: result.excesosPotencia,
              excedentesAutoconsumo: result.excedentesAutoconsumo,
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
              excedentesKwh: result.excedentesKwh,
              pexc: result.pexc,
              energyMargin: result.energyMargin,
              powerMargin: result.powerMargin
            } as any
          }
        });
        createdDrafts.push(draft);
      } catch (err: any) {
        console.error("Error calculando F1", f1.id, err);
        const errorDraft = await prisma.internalInvoice.create({
          data: {
            status: 'REQUIERE_REPARACION',
            repairData: { issue: err.message || "Error fatal desconocido" },
            invoiceType: 'NORMAL',
            clientId: contract.clientId,
            contractId: contract.id,
            supplyPointId: contract.supplyPointId,
            f1InvoiceId: f1.id,
            issueDate: new Date(),
            subtotal1: 0,
            taxPercentage: 21,
            taxAmount: 0,
            totalAmount: 0,
            totalMWh: 0,
            margin: 0,
            billingStart: f1.fechaInicio || new Date(),
            billingEnd: f1.fechaFin || new Date(),
            origin: 'INTERNAL_ENGINE',
            invoiceData: {}
          }
        });
        createdDrafts.push(errorDraft);
      }
    }

    return NextResponse.json({ success: true, count: createdDrafts.length });
  } catch (error: any) {
    console.error('Error calculating internal invoices:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
