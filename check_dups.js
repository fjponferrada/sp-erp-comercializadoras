require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const duplicates = await prisma.contract.groupBy({
    by: ['supplyPointId'],
    where: { status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] } },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } }
  });

  console.log(`Found ${duplicates.length} SupplyPoints with multiple ACTIVO contracts.`);
  
  for (const dup of duplicates) {
    const sp = await prisma.supplyPoint.findUnique({ where: { id: dup.supplyPointId }, select: { cups: true } });
    const contracts = await prisma.contract.findMany({
      where: { supplyPointId: dup.supplyPointId, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] } },
      select: { internalCode: true, createdAt: true, terminationDate: true, tipo: true }
    });
    console.log(`CUPS: ${sp.cups} has ${dup._count.id} active contracts:`, contracts.map(c => c.internalCode));
  }
}

main().catch(console.error).finally(() => process.exit(0));
