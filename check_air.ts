import { prisma } from './src/lib/prisma';

async function main() {
  const c = await prisma.contract.findFirst({
    where: { airtableData: { not: null }, pricingModel: 'FIJO' }
  });
  if (c) {
    console.log(Object.keys(c.airtableData));
    console.log(c.airtableData);
    console.log('p1e:', c.p1e);
  }
}

main();
