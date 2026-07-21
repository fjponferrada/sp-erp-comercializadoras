const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contract.findUnique({
    where: { contractCode: 'PRPR2510301219NM0F' }
  });
  if (c && c.airtableData) {
    const data = c.airtableData;
    console.log("tarifa:", data["tarifa"]);
    console.log("Tarifa:", data["Tarifa"]);
    console.log("Código Tarifa:", data["Código Tarifa"]);
    console.log("Codigo Tarifa:", data["Codigo Tarifa"]);
  }
}
main().finally(() => prisma.$disconnect());
