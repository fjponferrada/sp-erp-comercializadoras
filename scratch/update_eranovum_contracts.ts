import { prisma } from '../src/lib/prisma';

async function main() {
  // Find the target product "ERANOVUM BOE Index"
  const targetProduct = await prisma.product.findFirst({
    where: { name: 'ERANOVUM BOE Index' }
  });

  if (!targetProduct) {
    console.error("Target product 'ERANOVUM BOE Index' not found");
    return;
  }

  console.log(`Found target product ID: ${targetProduct.id}`);

  // Find active contracts matching criteria
  const contracts = await prisma.contract.findMany({
    where: {
      status: 'ACTIVO',
      client: {
        OR: [
          { name: { contains: 'eranovum', mode: 'insensitive' } },
          { businessName: { contains: 'eranovum', mode: 'insensitive' } }
        ]
      },
      supplyPoint: {
        tariff: { contains: '3.0TDVE', mode: 'insensitive' }
      }
    },
    include: {
      client: true,
      supplyPoint: true,
      product: true
    }
  });

  console.log(`Found ${contracts.length} active Eranovum 3.0TDVE contracts.`);

  let updatedCount = 0;
  for (const contract of contracts) {
    if (contract.productId !== targetProduct.id) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          productId: targetProduct.id,
          pricingModel: targetProduct.pricingModel // Ensure pricingModel syncs
        }
      });
      console.log(`Updated contract ${contract.id} (CUPS: ${contract.supplyPoint?.cups})`);
      updatedCount++;
    }
  }

  console.log(`Total updated: ${updatedCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
