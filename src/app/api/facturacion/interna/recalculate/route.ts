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
    const { draftIds } = body;

    if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
      return NextResponse.json({ message: 'draftIds is required' }, { status: 400 });
    }

    const drafts = await prisma.internalInvoice.findMany({
      where: {
        id: { in: draftIds },
        status: { in: ['BORRADOR', 'REQUIERE_REPARACION'] },
      },
      include: {
        f1Invoice: {
          include: {
            contract: {
              include: {
                brand: true,
                client: { include: { brand: true } },
              },
            },
            supplyPoint: true,
          },
        },
        contract: {
          include: {
            brand: true,
            client: { include: { brand: true } },
          },
        },
      },
    });

    const updatedDrafts = [];

    for (const draft of drafts) {
      const f1 = draft.f1Invoice;
      const contract = f1?.contract || draft.contract;

      if (!draft.f1InvoiceId || !f1 || !contract) {
        continue;
      }

      const companyId =
        draft.companyId || contract.brand?.companyId || contract.client?.brand?.companyId || null;
      const calculatedType = deduceInvoiceType(f1.jsonData);

      try {
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

        const updated = await prisma.internalInvoice.update({
          where: { id: draft.id },
          data: {
            status: result.hasCriticalError ? 'REQUIERE_REPARACION' : 'BORRADOR',
            invoiceType: calculatedType,
            clientId: effectiveContract.clientId,
            companyId: effectiveCompanyId,
            contractId: effectiveContract.id,
            repairData: result.repairData,
            subtotal1: result.totalBase,
            taxPercentage: result.taxPercentage ?? 21,
            taxAmount: result.taxAmount,
            totalAmount: result.totalAmount,
            totalMWh: result.totalF1MWh,
            margin: result.feeCost,
            billingStart: f1.fechaInicio || draft.billingStart,
            billingEnd: f1.fechaFin || draft.billingEnd,
            invoiceData: buildInternalInvoiceJsonData(result, effectiveContract) as any,
          },
        });
        updatedDrafts.push(updated);

        if (calculatedType === 'Rectificadora') {
          const companionF1 = await ensureCompanionAbonoF1(f1);
          if (
            companionF1 &&
            companionF1.id !== f1.id &&
            (!companionF1.internalInvoices || companionF1.internalInvoices.length === 0)
          ) {
            try {
              const abonoRes = await InternalBillingEngine.calculate(companionF1.id, true);
              const abonoDraft = await prisma.internalInvoice.create({
                data: {
                  status: abonoRes.hasCriticalError ? 'REQUIERE_REPARACION' : 'BORRADOR',
                  hidden: Boolean((draft as any).hidden),
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
                  billingStart: companionF1.fechaInicio || f1.fechaInicio || draft.billingStart,
                  billingEnd: companionF1.fechaFin || f1.fechaFin || draft.billingEnd,
                  origin: 'INTERNAL_ENGINE',
                  invoiceData: buildInternalInvoiceJsonData(abonoRes, effectiveContract) as any,
                },
              });
              updatedDrafts.push(abonoDraft);
            } catch (compErr) {
              console.error('Error auto-creando Abono compañero en recalculate', companionF1.id, compErr);
            }
          }
        }
      } catch (err: any) {
        console.error('Error recalculando borrador', draft.id, err);
        const errorUpdated = await prisma.internalInvoice.update({
          where: { id: draft.id },
          data: {
            status: 'REQUIERE_REPARACION',
            repairData: {
              issue: err.message || 'Error fatal desconocido al recalcular',
              isCritical: true,
            },
            subtotal1: 0,
            taxAmount: 0,
            totalAmount: 0,
            totalMWh: 0,
            margin: 0,
            invoiceData: {},
          },
        });
        updatedDrafts.push(errorUpdated);
      }
    }

    return NextResponse.json({ success: true, count: updatedDrafts.length });
  } catch (error: any) {
    console.error('Error in recalculate:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
