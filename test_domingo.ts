import { prisma } from './src/lib/prisma';

async function main() {
  const clients = await prisma.client.findMany();
  const client = clients.find(c => {
    const fullName = `${c.firstName || ''} ${c.lastName || ''} ${c.lastName2 || ''}`.toUpperCase();
    return fullName.includes('DOMINGO') && fullName.includes('QUESADA');
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

  console.log("CLIENT:", client.firstName, client.lastName);
  for (const contract of contracts) {
    console.log("CONTRACT P1E:", contract.p1e);
    console.log("CONTRACT P2E:", contract.p2e);
    console.log("CONTRACT P3E:", contract.p3e);
    console.log("--- INVOICE DRAFT ---");
    for (const inv of contract.internalInvoices) {
      console.log("Invoice ID:", inv.id);
      const data = inv.invoiceData as any;
      console.log("Energy ATR Details:");
      console.log(JSON.stringify(data?.energyAtrDetails, null, 2));
      console.log("Energy Market Details:");
      console.log(JSON.stringify(data?.energyMarketDetails, null, 2));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
