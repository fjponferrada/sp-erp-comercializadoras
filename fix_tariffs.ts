import { prisma } from './src/lib/prisma';

async function main() {
  console.log('Fetching contracts...');
  const contracts = await prisma.contract.findMany({
    include: {
      product: true,
      supplyPoint: true,
    }
  });

  console.log(`Total contracts found: ${contracts.length}`);

  let mismatches = 0;
  let fixed = 0;
  let notFound = 0;

  for (const c of contracts) {
    if (!c.productId || !c.product) continue;

    let realTariff = c.airtableData && typeof c.airtableData === 'object' ? (c.airtableData as any)['Tarifa'] : c.supplyPoint?.tariff;
    
    if (!realTariff) continue;

    if (realTariff !== c.product.tariff) {
      mismatches++;
      
      const targetProduct = await prisma.product.findFirst({
        where: {
          name: c.product.name,
          tariff: realTariff,
          brandId: c.product.brandId
        }
      });

      if (targetProduct) {
        await prisma.contract.update({
          where: { id: c.id },
          data: { productId: targetProduct.id }
        });
        fixed++;
      } else {
        notFound++;
        console.log(`No correct product found for: ${c.product.name} with tariff ${realTariff} (Contract: ${c.id})`);
      }
    }
  }

  console.log(`--- Summary ---`);
  console.log(`Mismatches found: ${mismatches}`);
  console.log(`Successfully fixed: ${fixed}`);
  console.log(`Matching product not found: ${notFound}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
