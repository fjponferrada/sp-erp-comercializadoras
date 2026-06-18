const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const normalInvoices = await prisma.invoice.findMany({
    where: { invoiceType: { not: 'Abono' } },
    take: 5,
    select: { invoiceType: true, subtotal1: true, invoiceData: true }
  });
  
  const abonoInvoices = await prisma.invoice.findMany({
    where: { invoiceType: 'Abono' },
    take: 5,
    select: { invoiceType: true, subtotal1: true, invoiceData: true }
  });
  
  console.log('NORMAL INVOICES:');
  for (const inv of normalInvoices) {
    console.log({
      type: inv.invoiceType,
      subtotal1: inv.subtotal1,
      baseImponible: inv.invoiceData ? inv.invoiceData['Base Imponible IVA'] : null
    });
  }

  console.log('\nABONO INVOICES:');
  for (const inv of abonoInvoices) {
    console.log({
      type: inv.invoiceType,
      subtotal1: inv.subtotal1,
      baseImponible: inv.invoiceData ? inv.invoiceData['Base Imponible IVA'] : null
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
