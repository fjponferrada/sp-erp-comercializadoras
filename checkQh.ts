import { prisma } from './src/lib/prisma';
async function run() {
  const comp = await prisma.company.findFirst({ where: { name: { contains: 'AED' } } });
  
  // count QH curves
  const qhCount = await prisma.loadCurve.count({
    where: { resolution: 'QUARTER_HOURLY' }
  });
  
  console.log("Total QH curves:", qhCount);
  
  // Find a sample of lengths
  const sample = await prisma.loadCurve.findMany({
    where: { resolution: 'QUARTER_HOURLY' },
    take: 10,
    select: { readings: true }
  });
  
  console.log("Sample lengths:", sample.map(s => s.readings.length));
}
run().finally(() => prisma.$disconnect());
