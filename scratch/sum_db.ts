import { prisma } from '../src/lib/prisma';

async function main() {
  const brandId = 'cmq6j25ko0000d44130cfn6oz';
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });

  const allInvoices = await prisma.invoice.findMany({
    where: {
      companyId: brand?.companyId,
      issueDate: { gte: new Date(2026, 3, 1), lte: new Date(2026, 5, 31) }
    },
  });

  let totalTax = 0;
  const seenInvoicesGlobal = new Set<string>();

  for (const inv of allInvoices) {
    if (inv.invoiceNumber) {
      if (seenInvoicesGlobal.has(inv.invoiceNumber)) continue;
      seenInvoicesGlobal.add(inv.invoiceNumber);
    }
    
    const isAbono = inv.invoiceType?.toLowerCase().includes('abono') || false;
    const data = inv.invoiceData as any;
    let taxAmount = data ? parseFloat(data['Importe Impuesto']?.toString().replace(',','.')) || 0 : 0;
    
    if (isAbono && taxAmount > 0) taxAmount = -taxAmount;
    
    totalTax += taxAmount;
  }

  console.log(`Pure DB Sum: ${totalTax}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
