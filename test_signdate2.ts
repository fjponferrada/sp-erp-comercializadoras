import { prisma } from './src/lib/prisma';

async function main() {
  const invId = 'cmrhun2bg0008p8414ya0lcwg';
  const inv = await prisma.internalInvoice.findUnique({
    where: { id: invId }
  });
  if (!inv) return;

  const contract = await prisma.contract.findUnique({
    where: { id: inv.contractId! },
  });
  
  console.log("Signature Date:", contract?.signatureDate);
  console.log("Activation Date:", contract?.activationDate);
  console.log("JSON Data:", JSON.stringify(contract?.jsonData, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
