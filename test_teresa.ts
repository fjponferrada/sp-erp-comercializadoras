import { prisma } from './src/lib/prisma';
import { InternalBillingEngine } from './src/lib/services/InternalBillingEngine';

async function main() {
  const invId = 'cmrhun11j0007p8417lqe5wfq'; // Teresa
  const inv = await prisma.internalInvoice.findUnique({
    where: { id: invId }
  });
  if (!inv || !inv.f1InvoiceId) return;

  const result = await InternalBillingEngine.calculate(inv.f1InvoiceId, false);
  console.log("TOTAL ERP:", result.totalAmount);
  console.log("ENERGY ATR DETAILS:", JSON.stringify(result.energyAtrDetails, null, 2));
  console.log("ENERGY MARKET DETAILS:", JSON.stringify(result.energyMarketDetails, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
