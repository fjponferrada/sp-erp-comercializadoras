import { prisma } from './src/lib/prisma';

async function main() {
  const contracts = await prisma.contract.findMany({
    include: {
      product: true,
      supplyPoint: true,
    },
    take: 50
  });

  for (const c of contracts) {
    if (!c.productId || !c.product) continue;
    const airTariff = c.airtableData ? (c.airtableData as any)['Tarifa'] : 'none';
    const spTariff = c.supplyPoint?.tariff;
    const prodTariff = c.product.tariff;

    if (airTariff !== prodTariff || spTariff !== prodTariff) {
      console.log(`Contract: ${c.id}`);
      console.log(`  Airtable Tarifa: ${airTariff}`);
      console.log(`  SupplyPoint Tarifa: ${spTariff}`);
      console.log(`  Product Tarifa: ${prodTariff}`);
      console.log(`  Product Name: ${c.product.name}`);
      console.log(`-----------------------------------`);
    }
  }
}

main().finally(() => prisma.$disconnect());
