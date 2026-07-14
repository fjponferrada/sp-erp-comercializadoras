import { prisma } from '../src/lib/prisma';

async function main() {
  const points = await prisma.supplyPoint.findMany({
    select: { cups: true, segment: true, annualConsumption: true }
  });

  const summary: Record<string, number> = {};
  let over100Mwh = 0;
  let over100MwhSegments: Record<string, number> = {};

  for (const p of points) {
    const s = p.segment || 'NULL';
    summary[s] = (summary[s] || 0) + 1;
    
    const cons = Number(p.annualConsumption || 0);
    if (cons > 100000) {
      over100Mwh++;
      over100MwhSegments[s] = (over100MwhSegments[s] || 0) + 1;
    }
  }

  console.log("--- Segment Summary ---");
  console.log(summary);
  console.log(`\n--- CUPS with > 100 MWh (${over100Mwh} total) ---`);
  console.log(over100MwhSegments);
}

main().catch(console.error).finally(() => prisma.$disconnect());
