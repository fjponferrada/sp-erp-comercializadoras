import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { prisma } from './src/lib/prisma';

async function main() {
  const cups = 'ES0031104918101017580F'; // Note: User typed SB0F but screenshot shows 580F. I will search both or use LIKE.

  const sps = await prisma.supplyPoint.findMany({
    where: { cups: { contains: 'ES0031104918101017' } }
  });
  console.log("Supply Points found:", sps.map(sp => sp.cups));

  const spIds = sps.map(sp => sp.id);

  const events = await prisma.switchingEvent.findMany({
    where: { 
      OR: [
        { supplyPointId: { in: spIds } },
        { cups: { contains: 'ES0031104918101017' } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log("\nRecent Switching Events for this CUPS:");
  for (const ev of events) {
    console.log(`- ${ev.proceso} (Paso ${ev.paso}): warning=${ev.warning} | error=${ev.tipoError}`);
  }

  const contracts = await prisma.contract.findMany({
    where: { supplyPointId: { in: spIds } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, contractCode: true, version: true, status: true, terminationDate: true, activationDate: true }
  });

  console.log("\nContracts for this CUPS:");
  console.table(contracts);
}

main().catch(console.error).finally(() => process.exit(0));
