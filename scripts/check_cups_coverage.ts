import { prisma } from '../src/lib/prisma';

async function run() {
  const d = new Date('2026-01-15T00:00:00.000Z');
  
  const curves = await prisma.loadCurve.findMany({
    where: { date: d },
    select: { cups: true }
  });

  const uniqueLoadCups = new Set<string>();
  for (const c of curves) {
    uniqueLoadCups.add(c.cups.length === 22 ? c.cups.substring(0, 20) : c.cups);
  }

  const sps = await prisma.supplyPoint.findMany({
    select: { cups: true }
  });

  const uniqueSpCups = new Set<string>();
  for (const sp of sps) {
    uniqueSpCups.add(sp.cups.length === 22 ? sp.cups.substring(0, 20) : sp.cups);
  }

  let mappedCount = 0;
  let unmappedCount = 0;
  
  for (const c of uniqueLoadCups) {
    if (uniqueSpCups.has(c)) {
      mappedCount++;
    } else {
      unmappedCount++;
    }
  }

  console.log(`For 2026-01-15:`);
  console.log(`Total unique CUPS in LoadCurve: ${uniqueLoadCups.size}`);
  console.log(`Mapped to SupplyPoint: ${mappedCount}`);
  console.log(`Unmapped (orphan LoadCurves): ${unmappedCount}`);
  
  if (uniqueLoadCups.size > 0) {
     console.log(`Coverage: ${((mappedCount / uniqueLoadCups.size) * 100).toFixed(2)}%`);
  }
}

run().then(() => prisma.$disconnect());
