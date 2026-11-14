import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { InternalBillingEngine } from '@/lib/services/InternalBillingEngine';
import {
  buildInternalInvoiceJsonData,
  deduceInvoiceType,
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

        const updated = await prisma.internalInvoice.update({
          where: { id: draft.id },
          data: {
            status: result.hasCriticalError ? 'REQUIERE_REPARACION' : 'BORRADOR',
            invoiceType: calculatedType,
            companyId,
            repairData: result.repairData,
            subtotal1: result.totalBase,
            taxPercentage: result.taxPercentage ?? 21,
            taxAmount: result.taxAmount,
            totalAmount: result.totalAmount,
            totalMWh: result.totalF1MWh,
            margin: result.feeCost,
            billingStart: f1.fechaInicio || draft.billingStart,
            billingEnd: f1.fechaFin || draft.billingEnd,
            invoiceData: buildInternalInvoiceJsonData(result, contract) as any,
          },
        });
        updatedDrafts.push(updated);
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
