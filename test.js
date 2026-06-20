const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: {
      invoiceNumber: { in: ['A260614793', 'A260614877', 'A260615017'] }
    }
  });

  console.log(JSON.stringify(invoices.map(i => ({
    num: i.invoiceNumber,
    issueDate: i.issueDate,
    billingStart: i.billingStart,
    billingEnd: i.billingEnd,
    origin: i.origin,
    d: i.invoiceData
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
