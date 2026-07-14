import { prisma } from '../src/lib/prisma';
import { calculateSegment } from '../src/lib/services/SegmentService';

async function main() {
  const points = await prisma.supplyPoint.findMany();
  let updated = 0;

  for (const p of points) {
    const newSegment = calculateSegment(p.tariff, p.annualConsumption, p.p1c, p.cnae);
    
    if (newSegment !== p.segment) {
      await prisma.supplyPoint.update({
        where: { id: p.id },
        data: { segment: newSegment }
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} supply points.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
