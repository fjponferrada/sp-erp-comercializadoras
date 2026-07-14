const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });
const prisma = new PrismaClient();

async function run() {
  console.log('Limpiando base de datos (facturas, contratos, sum, leads, clientes)...');
  await prisma.invoice.deleteMany();
  await prisma.contractModification.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.supplyPoint.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.client.deleteMany();
  console.log('Limpieza completada.');
}

run().catch(console.error).finally(() => prisma.$disconnect());
