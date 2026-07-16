const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const f1s = await prisma.f1Invoice.findMany({
    where: { 
      jsonData: {
        path: ['DatosGeneralesFacturaATR', 'DatosGeneralesFactura', 'TipoFactura'],
        string_contains: 'AR'
      }
    }
  });

  console.log(`Found ${f1s.length} AR F1s.`);

  let updated = 0;
  for (const f1 of f1s) {
    if (!f1.supplyPointId) continue;

    // Find the corresponding Abono invoice
    const matchingInvoice = await prisma.invoice.findFirst({
      where: {
        supplyPointId: f1.supplyPointId,
        invoiceType: 'Abono',
        f1InvoiceId: null,
        // Match dates 
        // billingStart: new Date(f1.fechaInicio),
        // billingEnd: new Date(f1.fechaFin)
      }
    });

    if (matchingInvoice) {
      await prisma.invoice.update({
        where: { id: matchingInvoice.id },
        data: { f1InvoiceId: f1.id }
      });
      updated++;
      console.log(`Linked F1 ${f1.numeroFactura} to Invoice ${matchingInvoice.invoiceNumber}`);
    } else {
        console.log(`No match for F1 ${f1.numeroFactura} (CUPS: ${f1.supplyPointId})`);
    }
  }
  
  console.log(`Updated ${updated} invoices.`);
}
main().catch(console.error);
