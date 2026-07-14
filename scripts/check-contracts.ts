import { prisma } from '../src/lib/prisma';

async function main() {
  const fakeProducts = await prisma.product.findMany({
    where: { name: { contains: 'Asesoramiento', mode: 'insensitive' } }
  });

  const ids = fakeProducts.map(p => p.id);
  
  const sampleContract = await prisma.contract.findFirst({
    where: { productId: { in: ids } },
    select: { id: true, svaConcept: true, svaPrice: true, airtableData: true }
  });

  console.log(JSON.stringify(sampleContract, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
