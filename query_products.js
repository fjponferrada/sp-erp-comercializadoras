const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ 
    select: { name: true, hasSelfConsumption: true, type: true }
  });
  console.log("Total products:", products.length);
  const autoProducts = products.filter(p => p.name.toLowerCase().includes('autoconsumo') || p.name.toLowerCase().includes('solar') || p.hasSelfConsumption);
  console.log("Auto products:");
  console.table(autoProducts);
}

main().finally(() => prisma.$disconnect());
