require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c1 = await prisma.contract.findFirst({ 
    where: { internalCode: 'NUEB26331151QW0F' },
    include: { client: true }
  });
  
  const c2 = await prisma.contract.findFirst({ 
    where: { internalCode: 'NUFR26331151QW0F' },
    include: { client: true }
  });
  
  const c0 = await prisma.contract.findFirst({
    where: { supplyPoint: { cups: 'ES0031104442493001QW0F' }, version: 0 },
    include: { client: true }
  });

  const clientByCif = await prisma.client.findFirst({
    where: { documentNumber: 'B88759287' },
    include: { contracts: { select: { internalCode: true, version: true, status: true, supplyPointId: true } } }
  });

  console.log('--- Versión 0 ---');
  console.log(c0 ? { code: c0.internalCode, status: c0.status, client: c0.client?.documentNumber, name: c0.client?.fullName } : 'Not found');

  console.log('--- NUEB (Versión 1) ---');
  console.log(c1 ? { code: c1.internalCode, status: c1.status, client: c1.client?.documentNumber, name: c1.client?.fullName } : 'Not found');
  
  console.log('--- NUFR (Versión 2) ---');
  console.log(c2 ? { code: c2.internalCode, status: c2.status, client: c2.client?.documentNumber, name: c2.client?.fullName } : 'Not found');
  
  console.log('--- Client B88759287 ---');
  console.log(clientByCif ? { name: clientByCif.fullName, contracts: clientByCif.contracts } : 'Not found');
}

main().catch(console.error).finally(() => process.exit(0));
