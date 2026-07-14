import { prisma } from '../src/lib/prisma';

async function main() {
  const invoice = await prisma.internalInvoice.findFirst({
    where: { contract: { supplyPoint: { cups: 'ES0031101499771003GD0F' } } },
    orderBy: { createdAt: 'desc' }
  });
  console.log("Draft found:", invoice ? invoice.id : 'no');
  if (invoice && invoice.invoiceData) {
    const data = invoice.invoiceData as any;
    console.log("powerDetails length:", data.powerDetails?.length);
    console.log("energyAtrDetails length:", data.energyAtrDetails?.length);
    console.log("energyMarketDetails length:", data.energyMarketDetails?.length);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
