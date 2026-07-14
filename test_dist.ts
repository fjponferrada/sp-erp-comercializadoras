import { prisma } from './src/lib/prisma';
async function run() {
  const curves = await prisma.loadCurve.findMany({
    where: { date: new Date('2025-09-01T00:00:00Z') }
  });
  const sps = await prisma.supplyPoint.findMany({ select: { cups: true, distributor: true } });
  const distMap = {};
  sps.forEach(sp => {
    distMap[sp.cups] = sp.distributor || 'Unknown';
    if (sp.cups.length === 22) distMap[sp.cups.substring(0, 20)] = sp.distributor || 'Unknown';
  });

  const byDist = {};
  curves.forEach(c => {
    const dist = distMap[c.cups] || 'Unknown/Missing SP';
    byDist[dist] = (byDist[dist] || 0) + 1;
  });
  console.log(byDist);
}
run();
