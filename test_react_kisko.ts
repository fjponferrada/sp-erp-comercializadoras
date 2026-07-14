import { prisma } from './src/lib/prisma';

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
      const data = inv.invoiceData as any;
      console.log("f1Readings:", JSON.stringify(data.f1Readings, null, 2));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
