import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
  const draft = await prisma.internalInvoice.findUnique({
    where: { id: 'cmridkp38001dq041ntpxdevl' },
    include: { f1Invoice: true }
  });

  if (!draft || !draft.f1InvoiceId) return;

  const result = await InternalBillingEngine.calculate(draft.f1InvoiceId, true);
  
  await prisma.internalInvoice.update({
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
        ...(draft.invoiceData as any),
        excedentesAutoconsumo: result.excedentesAutoconsumo,
        excedentesKwh: result.excedentesKwh,
        pexc: result.excedentesKwh ? result.excedentesAutoconsumo / result.excedentesKwh : 0
      }
    }
  });

  console.log("DB forcefully updated with:", result.excedentesAutoconsumo);
}
main().finally(() => prisma.$disconnect());
