import { prisma } from './src/lib/prisma';

async function checkArs() {
  const arF1s = await prisma.f1Invoice.findMany({
    where: {
      numeroFactura: { startsWith: 'AR-' },
      supplyPointId: { not: null }
    },
    include: { invoices: true, supplyPoint: true }
  });
  
  console.log(`Found ${arF1s.length} AR invoices.`);
  
  for (const ar of arF1s) {
    const originalCod = ar.numeroFactura.replace('AR-', '');
    const originalF1 = await prisma.f1Invoice.findFirst({
      where: { numeroFactura: originalCod },
      include: { invoices: true }
    });
    
    if (!originalF1) {
      console.log(`${ar.numeroFactura}: Original F1 ${originalCod} not found`);
      continue;
    }
    if (!originalF1.invoices || originalF1.invoices.length === 0) {
      console.log(`${ar.numeroFactura}: Original F1 ${originalCod} has NO linked supplier invoices`);
      continue;
    }
    
    const originalTotal = originalF1.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const inverseTotal = -originalTotal;
    
    const abonoInvoice = await prisma.invoice.findFirst({
      where: {
        supplyPointId: ar.supplyPointId,
        f1InvoiceId: null,
        totalAmount: {
          gte: inverseTotal - 0.05,
          lte: inverseTotal + 0.05
        }
      }
    });
    
    if (abonoInvoice) {
      console.log(`${ar.numeroFactura}: MATCH FOUND! Inverse Total: ${inverseTotal}. Invoice: ${abonoInvoice.invoiceNumber}`);
    } else {
      console.log(`${ar.numeroFactura}: NO MATCH FOUND for inverse total ${inverseTotal}. Searching for any unlinked negative invoices...`);
      const anyNeg = await prisma.invoice.findMany({
        where: {
          supplyPointId: ar.supplyPointId,
          f1InvoiceId: null,
          totalAmount: { lt: 0 }
        }
      });
      if (anyNeg.length > 0) {
        console.log(`  -> Found ${anyNeg.length} unlinked negative invoices for this CUPS, but totals don't match exactly: ${anyNeg.map(i => i.totalAmount).join(', ')}`);
      } else {
        console.log(`  -> No unlinked negative invoices exist for this CUPS.`);
      }
    }
  }
}

checkArs().catch(console.error).finally(() => prisma.$disconnect());
