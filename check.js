const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.penaltyInvoice.count({
    where: { invoiceNumber: { startsWith: 'AEDEN24' } }
  });
  console.log('Count:', count);
}

main().finally(() => prisma.$disconnect());
