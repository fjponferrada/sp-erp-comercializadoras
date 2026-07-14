import { prisma } from './src/lib/prisma';

async function main() {
  const inv = await prisma.internalInvoice.findUnique({
    where: { id: 'cmrhun2bg0008p8414ya0lcwg' }
  });
  console.log(JSON.stringify(inv?.f1Data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
