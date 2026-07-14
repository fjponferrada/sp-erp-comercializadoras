import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const prisma = new PrismaClient();
  const cups = 'ES0031405446869086QD';
  
  const lcs = await prisma.loadCurve.findMany({
    where: {
      cups,
      date: {
        gte: new Date('2026-05-31T22:00:00.000Z'),
        lt: new Date('2026-06-30T22:00:00.000Z') // up to July 1st 00:00
      }
    },
    orderBy: { date: 'asc' }
  });

  let totalMWh = 0;
  for (const lc of lcs) {
    let dayMWh = 0;
    for (const val of lc.readings) {
      dayMWh += (val || 0) / 1000.0;
    }
    console.log(`Date: ${lc.date.toISOString()}, MWh: ${dayMWh}`);
    totalMWh += dayMWh;
  }
  
  console.log(`Total MWh: ${totalMWh}`);
}
main().catch(console.error);
