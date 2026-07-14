import { prisma } from '../src/lib/prisma';
async function run() {
  const d = new Date('2026-01-01T00:00:00.000Z');
  
  const rawCurves = await prisma.loadCurve.findMany({ where: { date: d } });
  let rawSum = 0;
  for (const c of rawCurves) {
    if (c.resolution === 'QUARTER_HOURLY') {
      for (const r of c.readings) rawSum += r || 0;
    } else {
      for (const r of c.readings) rawSum += r || 0;
    }
  }

  const aggCurves = await prisma.aggregatedLoadCurve.findMany({ where: { date: d } });
  let aggSum = 0;
  for (const c of aggCurves) {
    for (const r of c.totalConsumption) aggSum += r || 0;
  }

  console.log(`Raw LoadCurve Sum for 2026-01-01: ${rawSum / 1000} MWh`);
  console.log(`AggregatedLoadCurve Sum for 2026-01-01: ${aggSum / 1000} MWh`);
  console.log(`Diff: ${rawSum / 1000 - aggSum / 1000} MWh`);
}
run().then(() => prisma.$disconnect());
