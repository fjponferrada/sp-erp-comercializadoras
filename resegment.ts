import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { calculateSegment } from './src/lib/services/SegmentService';

async function main() {
  console.log('Fetching supply points...');
  const supplyPoints = await prisma.supplyPoint.findMany();
  let updated = 0;
  
  for (const sp of supplyPoints) {
    const segment = calculateSegment(
      sp.tariff,
      sp.annualConsumption,
      sp.p1c,
      sp.cnae
    );
    
    if (sp.segment !== segment) {
      await prisma.supplyPoint.update({
        where: { id: sp.id },
        data: { segment }
      });
      updated++;
    }
  }
  
  console.log(`Updated ${updated} supply points. Total points: ${supplyPoints.length}`);
}

main().catch(console.error).finally(() => process.exit(0));
