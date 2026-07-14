import { prisma } from './src/lib/prisma';
async function run() {
  const res = await prisma.aggregatedLoadCurve.findMany({
    where: { date: { gte: new Date('2025-09-01T00:00:00Z'), lt: new Date('2025-10-01T00:00:00Z') } },
    orderBy: { date: 'asc' }
  });
  const daily = {};
  res.forEach(r => {
    const d = r.date.toISOString().slice(0, 10);
    daily[d] = (daily[d] || 0) + r.totalConsumption.reduce((a, b) => a + b, 0);
  });
  Object.entries(daily).forEach(([k, v]) => console.log(k + ': ' + (v / 1000).toFixed(2) + ' MWh'));
}
run();
