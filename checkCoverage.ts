import { prisma } from './src/lib/prisma';
import { format } from 'date-fns';

async function run() {
  const comp = await prisma.company.findFirst({ where: { name: { contains: 'AED' } } });
  
  const targetDate = new Date('2026-01-15T00:00:00.000Z');
  console.log(`Checking coverage for AED on ${format(targetDate, 'yyyy-MM-dd')}...`);

  // Get all unique CUPS for AED
  const sps = await prisma.supplyPoint.findMany({
    where: { client: { is: { brand: { is: { companyId: comp!.id } } } } },
    select: { cups: true }
  });
  
  const allCups = new Set(sps.map(sp => sp.cups));
  console.log(`Total CUPS for company: ${allCups.size}`);
  console.log("Sample AED CUPS:", Array.from(allCups).slice(0, 3));

  // Get all LoadCurves for this date
  const curves = await prisma.loadCurve.findMany({
    where: { date: targetDate },
    select: { cups: true }
  });
  
  const curveCups = new Set(curves.map(c => c.cups));
  console.log(`LoadCurves on this date: ${curveCups.size}`);
  console.log("Sample LoadCurve CUPS:", Array.from(curveCups).slice(0, 3));

  let missing = 0;
  for (const cups of allCups) {
    if (!curveCups.has(cups)) {
      missing++;
    }
  }
  
  console.log(`AED CUPS without LoadCurve: ${missing}`);
  console.log(`Coverage: ${(( (allCups.size - missing) / allCups.size) * 100).toFixed(2)}%`);
}

run().finally(() => prisma.$disconnect());
