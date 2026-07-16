const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: {
      invoiceNumber: { in: ['R24-08-00100', 'R24-08-00101', 'R24-08-00106'] }
    },
    include: { supplyPoint: true }
  });
  
  console.log(invoices.map(i => ({
    number: i.invoiceNumber,
    cups: i.supplyPoint?.cups,
    total: i.totalAmount,
    f1InvoiceId: i.f1InvoiceId
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
