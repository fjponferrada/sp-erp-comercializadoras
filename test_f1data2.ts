import { prisma } from './src/lib/prisma';

async function main() {
  const internalInv = await prisma.internalInvoice.findUnique({
    where: { id: 'cmrhun2bg0008p8414ya0lcwg' }
  });
  const inv = await prisma.invoice.findUnique({
    where: { id: internalInv?.f1InvoiceId! }
  });
  const f1 = typeof inv?.f1Data === 'string' ? JSON.parse(inv?.f1Data) : inv?.f1Data;
  console.log(JSON.stringify(f1?.periods, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
