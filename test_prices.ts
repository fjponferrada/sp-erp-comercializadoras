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
  
  console.log("Contract Prices:");
  console.log("P1:", contract?.p1e);
  console.log("P2:", contract?.p2e);
  console.log("P3:", contract?.p3e);
  console.log("P4:", contract?.p4e);
  console.log("P5:", contract?.p5e);
  console.log("P6:", contract?.p6e);
  console.log("Sign Date:", contract?.signDate);
}

main().catch(console.error).finally(() => prisma.$disconnect());
