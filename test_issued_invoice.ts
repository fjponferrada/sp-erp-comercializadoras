import { prisma } from './src/lib/prisma';

async function main() {
  const invs = await prisma.invoice.findMany({
    where: { f1InvoiceId: "cmqlldzcv00047841wcchb24j" }
  });
  if (invs.length === 0) {
    console.log("No issued invoices found for this F1.");
    return;
  }
  for (const inv of invs) {
    console.log("Invoice ID:", inv.id);
    console.log("Number:", inv.invoiceNumber);
    console.log("Total Amount:", inv.totalAmount);
    console.log("Base Imponible:", inv.baseImponible);
    console.log("Invoice Data JSON:", JSON.stringify(inv.invoiceData, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
