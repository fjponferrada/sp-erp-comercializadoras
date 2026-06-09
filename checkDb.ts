import { prisma } from './src/lib/prisma';

async function main() {
  const companies = await prisma.company.findMany();
  console.log('Total companies:', companies.length);
  for (const c of companies) {
    console.log(`- ID: ${c.id} | Name: ${c.name} | CIF: ${c.cif} | Address: ${c.address}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
