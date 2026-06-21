const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const inv = await prisma.invoice.findFirst();
  console.log("totalAmount:", inv.totalAmount);
  console.log("typeof:", typeof inv.totalAmount);
  console.log("is instance of Decimal?", inv.totalAmount.constructor.name);
}

check().then(() => prisma.$disconnect());
