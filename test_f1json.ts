import { prisma } from './src/lib/prisma';

async function main() {
  const inv = await prisma.internalInvoice.findUnique({
    where: { id: 'cmrhun2bg0008p8414ya0lcwg' }
  });
  if (!inv?.f1InvoiceId) return;
  const f1 = await prisma.f1Invoice.findUnique({
    where: { id: inv.f1InvoiceId }
  });
  
  const jd = typeof f1?.jsonData === 'string' ? JSON.parse(f1.jsonData) : f1?.jsonData;
  console.log(JSON.stringify(jd, null, 2).substring(0, 1000));
}

main().catch(console.error).finally(() => prisma.$disconnect());
