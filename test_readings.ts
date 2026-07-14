import { prisma } from './src/lib/prisma';
import { InternalBillingEngine } from './src/lib/services/InternalBillingEngine';

async function main() {
  const invId = 'cmrhun2bg0008p8414ya0lcwg';
  const inv = await prisma.internalInvoice.findUnique({
    where: { id: invId }
  });
  if (!inv || !inv.f1InvoiceId) return;

  const result = await InternalBillingEngine.calculate(inv.f1InvoiceId, false);
  console.log("REACTIVA COST:", result.reactiveEnergyCost);
  console.log("F1 READINGS:", JSON.stringify(result.f1Readings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
