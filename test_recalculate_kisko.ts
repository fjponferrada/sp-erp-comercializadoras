import { prisma } from './src/lib/prisma';
import { InternalBillingEngine } from './src/lib/services/InternalBillingEngine';

async function main() {
  const clients = await prisma.client.findMany();
  const client = clients.find(c => {
    const fullName = `${c.firstName || ''} ${c.lastName || ''} ${c.lastName2 || ''}`.toUpperCase();
    return fullName.includes('KISKO') || (c.businessName && c.businessName.toUpperCase().includes('KISKO'));
  });

  if (!client) {
    console.log("Client not found");
    return;
  }

  const contracts = await prisma.contract.findMany({
    where: { clientId: client.id },
    include: {
      internalInvoices: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  for (const contract of contracts) {
    for (const inv of contract.internalInvoices) {
      if (!inv.f1InvoiceId) continue;
      
      console.log("Recalculating invoice draft:", inv.id);
      const result = await InternalBillingEngine.calculate(inv.f1InvoiceId, false);
      
      console.log("OLD totalAmount:", (inv.invoiceData as any)?.totalAmount);
      console.log("NEW totalAmount:", result.totalAmount);
      console.log("reactiveEnergyCost:", result.reactiveEnergyCost);
      console.log("reactiveDetails:", result.reactiveDetails);
      console.log("f1Readings P3:", result.f1Readings['P3']);
      console.log("f1Readings P4:", result.f1Readings['P4']);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
