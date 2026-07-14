import { prisma } from '../src/lib/prisma';
async function main() {
  const invoices = await prisma.internalInvoice.findMany({
    where: { supplyPoint: { cups: { contains: 'ES0031105546437024DF0F' } } },
    select: { id: true, billingStart: true, billingEnd: true, invoiceData: true }
  });
  
  invoices.forEach(i => {
    const data = i.invoiceData as any;
    if (data?.excedentesKwh) {
      console.log(`Invoice ${i.id} | Start: ${i.billingStart} | End: ${i.billingEnd}`);
      console.log(` - excedentesKwh: ${data.excedentesKwh}`);
      console.log(` - excedentesAutoconsumo: ${data.excedentesAutoconsumo}`);
      console.log(` - pexc: ${data.pexc}`);
    }
  });
}
main().finally(() => prisma.$disconnect());
