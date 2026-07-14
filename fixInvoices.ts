import { prisma } from './src/lib/prisma';
async function main() {
  const invoicesNullSp = await prisma.invoice.findMany({ where: { supplyPointId: null } });
  let fixed = 0;
  
  for (const inv of invoicesNullSp) {
    const cups = (inv.invoiceData as any)?.CUPS?.trim();
    if (cups) {
      const sp = await prisma.supplyPoint.findFirst({ where: { cups } });
      if (sp) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { supplyPointId: sp.id }
        });
        fixed++;
      }
    }
  }
  console.log(`Total invoices fixed: ${fixed}`);
}
main().finally(() => prisma['$disconnect']());
