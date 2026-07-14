import { prisma } from './src/lib/prisma';
import { InternalBillingEngine } from './src/lib/services/InternalBillingEngine';

async function main() {
  const invId = 'cmrhun2bg0008p8414ya0lcwg'; // This is internal invoice ID
  const inv = await prisma.internalInvoice.findUnique({
    where: { id: invId }
  });
  if (!inv || !inv.f1InvoiceId) return;

  const result = await InternalBillingEngine.calculate(inv.f1InvoiceId, false);
  console.log("F1 READINGS:", result.periods); // actually result.periods doesn't have reactCons!
  const providerTotal = 2162.44;
  console.log("DIFFERENCE:", providerTotal - result.totalAmount);

  // Let's print the energy details to see prices
  console.log("ENERGY ATR DETAILS:", JSON.stringify(result.energyAtrDetails, null, 2));
  console.log("ENERGY MARKET DETAILS:", JSON.stringify(result.energyMarketDetails, null, 2));
  console.log('REACTIVE ENERGY COST:', result.reactiveEnergyCost);
  console.log("PERIODS:", JSON.stringify(result.periods, null, 2));

  // Let's check the contract product to see if it's fixed or indexed
  const contract = await prisma.contract.findUnique({
    where: { id: inv.contractId! },
    include: { product: true }
  });
  console.log("Pricing Model:", contract?.pricingModel);
  if (contract?.product) {
    console.log("Product:", contract.product.name);
    console.log("Prices:", contract.product.p1e, contract.product.p2e, contract.product.p3e, contract.product.p4e, contract.product.p5e, contract.product.p6e);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
