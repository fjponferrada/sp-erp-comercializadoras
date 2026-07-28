import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const cCode = 'AEDAVP25714122473MA';
  const contracts = await prisma.contract.findMany({
    where: { contractCode: cCode },
    include: { supplyPoint: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log("Contracts for AEDAVP25714122473MA:");
  for (const c of contracts) {
    console.log(`- ID: ${c.id}, Version: ${c.version}, Status: ${c.status}, Type: ${c.tipo}, SP: ${c.supplyPointId}, termDate: ${c.terminationDate}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
