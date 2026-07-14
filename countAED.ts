import { prisma } from './src/lib/prisma';

async function main() {
  const companies = await prisma.company.findMany({
    where: { name: 'AED Energia, SL' }
  });
  console.log("Total AED companies:", companies.length);
  for (const c of companies) {
    console.log(`- ID: ${c.id}, CIF: ${c.cif}, Address: ${c.address}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
