import { prisma } from '../src/lib/prisma';

async function main() {
  const client = await prisma.client.findFirst({
    where: { vatNumber: '34001966P' },
    include: {
      supplyPoints: {
        include: { contracts: true }
      }
    }
  });
  console.log("CLIENT:", JSON.stringify(client, null, 2));

  const invoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'A260717844' }
  });
  console.log("INVOICE:", JSON.stringify(invoice, null, 2));
}

main().catch(console.error);
