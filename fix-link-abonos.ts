import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLinks() {
  console.log("Searching for Abono invoices linked to Normal F1s...");
  
  // Find all invoices that are Abono
  const abonos = await prisma.invoice.findMany({
    where: { invoiceType: 'Abono', f1InvoiceId: { not: null } },
    include: { f1Invoice: true }
  });
  
  console.log(`Found ${abonos.length} Abono invoices linked to an F1.`);
  let fixed = 0;
  
  for (const abono of abonos) {
    if (!abono.f1Invoice?.numeroFactura.startsWith('AR-')) {
      console.log(`Abono ${abono.invoiceNumber} is linked to Normal F1 ${abono.f1Invoice?.numeroFactura}. Fixing...`);
      
      const arF1 = await prisma.f1Invoice.findFirst({
        where: { numeroFactura: `AR-${abono.f1Invoice?.numeroFactura}` }
      });
      
      if (arF1) {
        await prisma.invoice.update({
          where: { id: abono.id },
          data: { f1InvoiceId: arF1.id }
        });
        console.log(`  -> Relinked to ${arF1.numeroFactura}`);
        fixed++;
      } else {
        console.log(`  -> ERROR: AR F1 not found for ${abono.f1Invoice?.numeroFactura}. Unlinking so it can be picked up later.`);
        await prisma.invoice.update({
          where: { id: abono.id },
          data: { f1InvoiceId: null }
        });
        fixed++;
      }
    }
  }
  console.log(`Done. Fixed ${fixed} links.`);
}

fixLinks()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
