import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const sps = await prisma.supplyPoint.findMany({
    where: { id: { in: ['cmq6yly4d0ajric419uq1e0ty', 'cmqpxmwqt0034ew41qc1fhbjo'] } },
    include: { client: true, contracts: true }
  });
  console.log(JSON.stringify(sps, null, 2));
}

run().catch(console.error).finally(()=>prisma.$disconnect());
