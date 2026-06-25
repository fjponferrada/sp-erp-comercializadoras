import { prisma } from '../src/lib/prisma';

async function main() {
  const inv = await prisma.invoice.findUnique({
    where: { invoiceNumber: 'A260615450' },
  });

  if (inv && inv.pdfData) {
    console.log("Keys in pdfData:");
    console.log(Object.keys(inv.pdfData));
    
    // Check if there are keys containing 'CUPS'
    const cupsKeys = Object.keys(inv.pdfData).filter(k => k.toLowerCase().includes('cups'));
    console.log("Keys containing CUPS:", cupsKeys);
    
    // Check if there are keys containing 'suministro' or 'punto'
    const supplyKeys = Object.keys(inv.pdfData).filter(k => k.toLowerCase().includes('suministro') || k.toLowerCase().includes('punto'));
    console.log("Keys containing supply:", supplyKeys);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
