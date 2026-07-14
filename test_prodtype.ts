import { prisma } from './src/lib/prisma';

async function main() {
  const invId = 'cmrhun2bg0008p8414ya0lcwg';
  const inv = await prisma.internalInvoice.findUnique({
    where: { id: invId }
  });
  if (!inv) return;

  const contract = await prisma.contract.findUnique({
    where: { id: inv.contractId! },
    include: { product: true }
  });
  console.log("Product type:", contract?.product?.type);
}

main().catch(console.error).finally(() => prisma.$disconnect());
