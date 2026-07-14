import { prisma } from '../lib/prisma';

async function run() {
  const c = await prisma.aggregatedLoadCurve.count();
  console.log('AggregatedLoadCurve:', c);
  
  const c2 = await prisma.loadCurve.count();
  console.log('LoadCurve:', c2);
  
  const sample = await prisma.aggregatedLoadCurve.findFirst({
    orderBy: { date: 'desc' }
  });
  console.log('Sample aggregated:', sample);
}

run().then(() => process.exit(0));
