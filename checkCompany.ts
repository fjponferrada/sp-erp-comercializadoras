import { prisma } from './src/lib/prisma';

async function main() {
  const company = await prisma.company.findUnique({
    where: { cif: 'B10915544' }
  });
  console.log(company);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
