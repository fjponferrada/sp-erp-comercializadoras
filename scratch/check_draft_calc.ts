import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
  const draft = await prisma.internalInvoice.findUnique({
    where: { id: 'cmridkp38001dq041ntpxdevl' },
    include: { f1Invoice: true }
  });

  if (!draft || !draft.f1InvoiceId) return;

  const result = await InternalBillingEngine.calculate(draft.f1InvoiceId, true);
  console.log("Calculated excedentesKwh:", result.excedentesKwh);
  console.log("Calculated excedentesAutoconsumo:", result.excedentesAutoconsumo);
  console.log("pexc:", result.excedentesAutoconsumo / result.excedentesKwh);
}
main().finally(() => prisma.$disconnect());
