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

    const draftsToRepair = await prisma.internalInvoice.findMany({
      where: {
        id: { in: draftIds },
        status: { in: ['BORRADOR', 'REQUIERE_REPARACION'] },
      },
      include: {
        contract: {
          include: {
            brand: true,
            client: { include: { brand: true } },
          },
        },
        f1Invoice: {
          include: {
            contract: {
              include: {
                brand: true,
                client: { include: { brand: true } },
              },
            },
          },
        },
      },
    });

    const repairedInvoices = [];

    for (const draft of draftsToRepair) {
      const f1 = draft.f1Invoice;
      const contract = draft.contract || f1?.contract;
      if (!f1 || !contract) continue;

      const companyId =
        draft.companyId || contract.brand?.companyId || contract.client?.brand?.companyId || null;

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
            invoiceType: deduceInvoiceType(f1.jsonData),
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
            invoiceData: buildInternalInvoiceJsonData(result, effectiveContract, true) as any,
          },
        });

        repairedInvoices.push(updated);
      } catch (err) {
        console.error('Error repairing draft', draft.id, err);
      }
    }

    return NextResponse.json({ success: true, count: repairedInvoices.length });
  } catch (error: any) {
    console.error('Error repairing internal invoices:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
