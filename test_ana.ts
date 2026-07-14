import { prisma } from './src/lib/prisma';
import { InternalBillingEngine } from './src/lib/services/InternalBillingEngine';

async function main() {
  const invs = await prisma.internalInvoice.findMany({
    where: {
      client: {
        businessName: { contains: 'BUJALANCE' }
      }
    },
    include: {
      client: true,
      f1Invoice: {
        include: { contract: true }
      }
    }
  });
  
  if (invs.length > 0) {
    const inv = invs[0];
    const result = await InternalBillingEngine.calculate(inv.f1InvoiceId!, false);
    
    await prisma.internalInvoice.update({
      where: { id: inv.id },
      data: {
        subtotal1: result.totalBase,
        taxAmount: result.taxAmount,
        totalAmount: result.totalAmount,
        invoiceData: {
          ...(inv.invoiceData as object || {}),
          svaCost: result.svaCost,
          svaConcept: result.svaConcept
        } as any
      }
    });
    
    console.log("UPDATED INVOICE IN DB FOR SVA.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
