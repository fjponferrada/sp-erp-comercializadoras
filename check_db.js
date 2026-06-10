const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sp = await prisma.supplyPoint.findMany({ take: 5, select: { annualConsumption: true } });
  console.log("SupplyPoints (annualConsumption):", sp);
  
  const inv = await prisma.invoice.findMany({ take: 5, select: { totalMWh: true, baseImponibleIva: true, margin: true } });
  console.log("Invoices (totalMWh):", inv);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
