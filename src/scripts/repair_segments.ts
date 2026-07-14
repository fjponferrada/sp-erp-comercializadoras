import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { calculateSegment } from '../lib/services/SegmentService';

async function main() {
  const orphans = await prisma.supplyPoint.findMany({
    where: {
      OR: [
        { segment: null },
        { segment: '' }
      ]
    }
  });

  console.log(`Found ${orphans.length} orphaned SupplyPoints without a segment.`);

  let updated = 0;
  for (const sp of orphans) {
    const newSegment = calculateSegment(
      sp.tariff,
      sp.annualConsumption,
      sp.p1c,
      sp.cnae
    );
    
    if (newSegment) {
      await prisma.supplyPoint.update({
        where: { id: sp.id },
        data: { segment: newSegment }
      });
      updated++;
    }
  }
  
  console.log(`Successfully updated ${updated} SupplyPoints with their calculated segment.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
