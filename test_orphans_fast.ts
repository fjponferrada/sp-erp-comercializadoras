import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function check() {
  const lc_cups = await prisma.$queryRaw`
    SELECT DISTINCT cups FROM "LoadCurve" WHERE date >= '2026-03-01' AND date <= '2026-03-31'
  ` as { cups: string }[];
  
  const sps = await prisma.supplyPoint.findMany({
    select: { cups: true, segment: true }
  });
  
  const spsMap = new Map();
  for (const sp of sps) {
    const base = sp.cups.length === 22 ? sp.cups.substring(0, 20) : sp.cups;
    spsMap.set(base, sp.segment);
    spsMap.set(sp.cups, sp.segment);
  }

  let missingCount = 0;
  let missingSegmentCount = 0;
  
  for (const row of lc_cups) {
    const segment = spsMap.get(row.cups);
    if (segment === undefined) {
      missingCount++;
    } else if (!segment) {
      missingSegmentCount++;
    }
  }
  
  console.log(`Unique CUPS in LoadCurve (March): ${lc_cups.length}`);
  console.log(`CUPS not found in SupplyPoint: ${missingCount}`);
  console.log(`CUPS with empty segment: ${missingSegmentCount}`);
}
check().finally(() => prisma.$disconnect());
