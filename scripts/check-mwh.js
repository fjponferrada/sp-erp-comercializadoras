const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: { totalMWh: { not: null } },
    take: 5,
    select: { id: true, totalMWh: true }
  });
  console.log('Invoices MWh:', invoices);
}

main().catch(console.error).finally(() => prisma.$disconnect());
