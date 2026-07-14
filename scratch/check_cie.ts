import { prisma } from '../src/lib/prisma';

async function main() {
  const brandId = 'cmq6j25ko0000d44130cfn6oz'; // AED
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { company: true },
  });
  
  console.log('Brand:', brand?.name);
  console.log('Company:', brand?.company?.name);
  console.log('CIE:', brand?.company?.cie);
  
  // Try to find the correct brand or company
  const allCompanies = await prisma.company.findMany();
  for (const c of allCompanies) {
    if (c.cie) {
       console.log(`Company ${c.name} has CIE: ${c.cie}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
