const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c1 = await prisma.contract.findFirst({ where: { internalCode: 'PRPR25711046BG0F' } });
  const c2 = await prisma.contract.findFirst({ where: { internalCode: 'PRPR26561312BG0F' } });
  
  console.log('--- VIEJO: PRPR25711046BG0F ---');
  console.log(c1 ? {
    status: c1.status,
    vol: c1.estimatedVolume,
    createdAt: c1.createdAt,
    requestDate: c1.requestDate,
    activationDate: c1.activationDate,
    terminationDate: c1.terminationDate,
    fechaPrevistaBaja: c1.fechaPrevistaBaja
  } : 'Not found');
  
  console.log('--- NUEVO: PRPR26561312BG0F ---');
  console.log(c2 ? {
    status: c2.status,
    vol: c2.estimatedVolume,
    createdAt: c2.createdAt,
    requestDate: c2.requestDate,
    activationDate: c2.activationDate,
    terminationDate: c2.terminationDate,
    fechaPrevistaBaja: c2.fechaPrevistaBaja
  } : 'Not found');
}

main().catch(console.error).finally(() => process.exit(0));
