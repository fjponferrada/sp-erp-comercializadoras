import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { InternalBillingEngine } from '@/lib/services/InternalBillingEngine';
import {
  buildInternalInvoiceJsonData,
  deduceInvoiceType,
  ensureCompanionAbonoF1,
} from '@/lib/services/internalInvoiceMapper';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { f1Ids } = body;

    if (!f1Ids || !Array.isArray(f1Ids) || f1Ids.length === 0) {
      return NextResponse.json({ message: 'f1Ids is required' }, { status: 400 });
    }

    const f1s = await prisma.f1Invoice.findMany({
      where: { id: { in: f1Ids } },
      include: {
        contract: {
          include: {
            brand: true,
            client: { include: { brand: true } },
          },
        },
        supplyPoint: true,
        internalInvoices: {
          select: { id: true },
        },
      },
    });

    const createdDrafts = [];

    for (const f1 of f1s) {
      if (!f1.contractId || !f1.contract || !f1.supplyPointId) {
        continue;
      }

      // Evitar duplicados si ya se generó una factura interna para este F1
      if (f1.internalInvoices && f1.internalInvoices.length > 0) {
        continue;
      }

      const contract = f1.contract;
      const companyId = contract.brand?.companyId || contract.client?.brand?.companyId || null;
      const calculatedType = deduceInvoiceType(f1.jsonData);

      try {
        // Ejecuta el cálculo forzando el auto-ajuste de la CCH si fuera necesario
        const result = await InternalBillingEngine.calculate(f1.id, true);
        const effectiveContract =
          result.effectiveContractId && result.effectiveContractId !== contract.id
            ? (await prisma.contract.findUnique({
                where: { id: result.effectiveContractId },
                include: { brand: true, client: { include: { brand: true } } },
              })) || contract
            : contract;
        const effectiveCompanyId =
          effectiveContract.brand?.companyId || effectiveContract.client?.brand?.companyId || companyId;

        const draft = await prisma.internalInvoice.create({
          data: {
            status: result.hasCriticalError ? 'REQUIERE_REPARACION' : 'BORRADOR',
            repairData: result.repairData,
            invoiceType: calculatedType,
            clientId: effectiveContract.clientId,
            companyId: effectiveCompanyId,
            contractId: effectiveContract.id,
            supplyPointId: effectiveContract.supplyPointId,
            f1InvoiceId: f1.id,
            issueDate: new Date(),
            subtotal1: result.totalBase,
            taxPercentage: result.taxPercentage ?? 21,
            taxAmount: result.taxAmount,
            totalAmount: result.totalAmount,
            totalMWh: result.totalF1MWh,
            margin: result.feeCost,
            billingStart: f1.fechaInicio || new Date(),
            billingEnd: f1.fechaFin || new Date(),
            origin: 'INTERNAL_ENGINE',
            invoiceData: buildInternalInvoiceJsonData(result, effectiveContract) as any,
          },
        });
        createdDrafts.push(draft);

        if (calculatedType === 'Rectificadora') {
          const companionF1 = await ensureCompanionAbonoF1(f1);
          if (
            companionF1 &&
            companionF1.id !== f1.id &&
            !f1Ids.includes(companionF1.id) &&
            (!companionF1.internalInvoices || companionF1.internalInvoices.length === 0)
          ) {
            try {
              const abonoRes = await InternalBillingEngine.calculate(companionF1.id, true);
              const abonoDraft = await prisma.internalInvoice.create({
                data: {
                  status: abonoRes.hasCriticalError ? 'REQUIERE_REPARACION' : 'BORRADOR',
                  repairData: abonoRes.repairData,
                  invoiceType: deduceInvoiceType(companionF1.jsonData),
                  clientId: effectiveContract.clientId,
                  companyId: effectiveCompanyId,
                  contractId: effectiveContract.id,
                  supplyPointId: effectiveContract.supplyPointId,
                  f1InvoiceId: companionF1.id,
                  issueDate: new Date(),
                  subtotal1: abonoRes.totalBase,
                  taxPercentage: abonoRes.taxPercentage ?? 21,
                  taxAmount: abonoRes.taxAmount,
                  totalAmount: abonoRes.totalAmount,
                  totalMWh: abonoRes.totalF1MWh,
                  margin: abonoRes.feeCost,
                  billingStart: companionF1.fechaInicio || f1.fechaInicio || new Date(),
                  billingEnd: companionF1.fechaFin || f1.fechaFin || new Date(),
                  origin: 'INTERNAL_ENGINE',
                  invoiceData: buildInternalInvoiceJsonData(abonoRes, effectiveContract) as any,
                },
              });
              createdDrafts.push(abonoDraft);
            } catch (compErr) {
              console.error('Error auto-calculando Abono compañero', companionF1.id, compErr);
            }
          }
        }
      } catch (err: any) {
        console.error('Error calculando F1', f1.id, err);
        const errorDraft = await prisma.internalInvoice.create({
          data: {
            status: 'REQUIERE_REPARACION',
            repairData: { issue: err.message || 'Error fatal desconocido', isCritical: true },
            invoiceType: calculatedType,
            clientId: contract.clientId,
            companyId,
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
            invoiceData: {},
          },
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
