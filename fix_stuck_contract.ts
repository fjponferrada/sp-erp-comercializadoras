import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const oldContractId = 'cmq6z3xnj0ordic41gtmtem1b';
  
  await prisma.contract.update({
    where: { id: oldContractId },
    data: { 
      status: 'FINALIZADO',
      terminationDate: new Date('2026-07-22T00:00:00.000Z')
    }
  });
  console.log("Old contract finalized successfully");
}

main().catch(console.error).finally(() => prisma.$disconnect());
