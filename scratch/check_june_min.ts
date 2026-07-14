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

  let minAppliedCount = 0;
  for (const inv of allInvoices) {
    const devengoDate = inv.billingEnd || inv.issueDate;
    if (devengoDate >= new Date(2026, 5, 1)) {
      const data = inv.invoiceData as any;
      let isMinApplied = false;
      const minSuperadoValue = data ? (data['Minimo Importe IE Superado'] ?? data.minimoImporteIESuperado) : undefined;
      
      if (minSuperadoValue !== undefined && String(minSuperadoValue).trim() !== '') {
         const flag = String(minSuperadoValue).trim().toLowerCase();
         isMinApplied = flag === '0' || flag === 'false';
      }
      if (isMinApplied) minAppliedCount++;
    }
  }

  console.log(`June invoices with minimum applied: ${minAppliedCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
