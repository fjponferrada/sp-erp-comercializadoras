const { prisma } = require('./src/lib/prisma');

async function run() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { supplyPoint: { cups: { contains: 'ES0031101498164002PH0F' } } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, contractId: true }
  });
  console.log('F1 Contract ID:', f1.contractId);

  const contracts = await prisma.contract.findMany({
    where: { supplyPoint: { cups: { contains: 'ES0031101498164002PH0F' } } },
    select: { id: true, status: true, version: true, p1e: true, p1p: true, createdAt: true, airtableId: true }
  });

  console.log('Contracts for CUPS:', contracts);
}

run().catch(console.error).finally(() => prisma.$disconnect());
