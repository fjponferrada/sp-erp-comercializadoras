const { prisma } = require('./src/lib/prisma');

async function main() {
  const invoice = await prisma.internalInvoice.findFirst({
    where: { contract: { supplyPoint: { cups: 'ES0031101499771003GD0F' } } },
    orderBy: { createdAt: 'desc' }
  });
  console.log("Draft found:", invoice ? invoice.id : 'no');
  if (invoice && invoice.invoiceData) {
    console.log("powerDetails length:", invoice.invoiceData.powerDetails?.length);
    console.log("powerDetails exists?", !!invoice.invoiceData.powerDetails);
    console.log("energyAtrDetails length:", invoice.invoiceData.energyAtrDetails?.length);
    console.log("energyMarketDetails length:", invoice.invoiceData.energyMarketDetails?.length);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
