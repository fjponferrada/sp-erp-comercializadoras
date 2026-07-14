import { prisma } from './src/lib/prisma';

async function main() {
  const brand = await prisma.brand.findFirst({
    where: { name: { contains: 'AED', mode: 'insensitive' } }
  });
  console.log('--- AED BRAND ID ---');
  console.log(brand ? brand.id : 'NOT FOUND');
  console.log('--------------------');
}

main().finally(() => prisma.$disconnect());
