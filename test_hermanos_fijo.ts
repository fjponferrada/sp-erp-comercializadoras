import { prisma } from './src/lib/prisma';
import { InternalBillingEngine } from './src/lib/services/InternalBillingEngine';

async function main() {
  const invId = 'cmrhun2bg0008p8414ya0lcwg'; // This is internal invoice ID
  const inv = await prisma.internalInvoice.findUnique({
    where: { id: invId }
  });
  if (!inv || !inv.f1InvoiceId) return;

  // Let's force pricingModel to FIJO in the DB temporarily
  await prisma.contract.update({
    where: { id: inv.contractId! },
    data: { pricingModel: 'FIJO' }
  });

  console.log("Recalculating with FIJO...");
  const result = await InternalBillingEngine.calculate(inv.f1InvoiceId, false);
  console.log("TOTAL ERP (FIJO):", result.totalAmount);
  
  // Calculate difference
  const providerTotal = 2162.44;
  console.log("DIFFERENCE:", providerTotal - result.totalAmount);

  // Let's print the energy details to see prices
  console.log("ENERGY ATR DETAILS:", JSON.stringify(result.energyAtrDetails, null, 2));
  console.log("ENERGY MARKET DETAILS:", JSON.stringify(result.energyMarketDetails, null, 2));

  // revert back
  await prisma.contract.update({
    where: { id: inv.contractId! },
    data: { pricingModel: null }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
