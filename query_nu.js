require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c1 = await prisma.contract.findFirst({ where: { internalCode: 'NUEB26331151QW0F' } });
  const c2 = await prisma.contract.findFirst({ where: { internalCode: 'NUFR26331151QW0F' } });
  
  console.log('--- NUEB (Versión 1) ---');
  console.log(c1 ? {
    status: c1.status,
    createdAt: c1.createdAt,
    activationDate: c1.activationDate,
    terminationDate: c1.terminationDate,
    nSolicitud: c1.nSolicitud
  } : 'Not found');
  
  console.log('--- NUFR (Versión 2) ---');
  console.log(c2 ? {
    status: c2.status,
    createdAt: c2.createdAt,
    activationDate: c2.activationDate,
    terminationDate: c2.terminationDate,
    nSolicitud: c2.nSolicitud
  } : 'Not found');
}

main().catch(console.error).finally(() => process.exit(0));
