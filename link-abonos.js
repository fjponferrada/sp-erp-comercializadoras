const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function linkAbonos() {
  console.log("Locating unlinked AR invoices...");
  
  // Find all F1 invoices that are AR and have no linked supplier invoice
  const arF1s = await prisma.f1Invoice.findMany({
    where: {
      numeroFactura: { startsWith: 'AR-' },
    },
    include: { invoices: true }
  });
  
  let linkedCount = 0;
  
  for (const ar of arF1s) {
    if (ar.invoices && ar.invoices.length > 0) continue; // Already linked
    
    // Find the original F1
    const originalCod = ar.numeroFactura.replace('AR-', '');
    const originalF1 = await prisma.f1Invoice.findFirst({
      where: { numeroFactura: originalCod },
      include: { invoices: true }
    });
    
    if (!originalF1 || !originalF1.invoices || originalF1.invoices.length === 0) {
      continue; // No original F1 or no supplier invoice linked to original F1
    }
    
    // Calculate total amount of original supplier invoice
    const originalTotal = originalF1.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const inverseTotal = -originalTotal;
    
    if (inverseTotal >= 0) continue; // Should be a refund (negative)
    
    // Try to find the supplier invoice (Abono)
    const abonoInvoice = await prisma.invoice.findFirst({
      where: {
        supplyPointId: ar.supplyPointId,
        f1InvoiceId: null, // Unlinked
        totalAmount: {
          gte: inverseTotal - 0.05,
          lte: inverseTotal + 0.05
        }
      }
    });
    
    if (abonoInvoice) {
      console.log(`Linking Abono Invoice ${abonoInvoice.invoiceNumber} to AR F1 ${ar.numeroFactura} (Amount: ${abonoInvoice.totalAmount})`);
      await prisma.invoice.update({
        where: { id: abonoInvoice.id },
        data: { f1InvoiceId: ar.id }
      });
      linkedCount++;
    }
  }
  
  console.log(`Successfully linked ${linkedCount} AR invoices to their supplier invoices.`);
}

linkAbonos().catch(console.error).finally(() => prisma.$disconnect());
