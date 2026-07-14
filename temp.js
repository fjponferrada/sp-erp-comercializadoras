require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const brand = await prisma.brand.findFirst({
      where: { name: { contains: 'AED', mode: 'insensitive' } }
    });
    console.log('--- RESULTADO ---');
    console.log('BRAND_ID_AED:', brand ? brand.id : 'NOT FOUND');
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
