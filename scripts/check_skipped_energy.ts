import { prisma } from '../src/lib/prisma';

async function run() {
  const d = new Date('2026-01-15T00:00:00.000Z');
  
  const curves = await prisma.loadCurve.findMany({
    where: { date: d }
  });

  const sps = await prisma.supplyPoint.findMany({
    select: { cups: true, contracts: { select: { activationDate: true, terminationDate: true } } }
  });

  interface Window { start: number; end: number; }
  const cupsWindows = new Map<string, Window[]>();
  
  for (const sp of sps) {
    const base = sp.cups.length === 22 ? sp.cups.substring(0, 20) : sp.cups;
    const windows: Window[] = [];
    for (const c of sp.contracts) {
      if (c.activationDate) {
        windows.push({
          start: c.activationDate.getTime(),
          end: c.terminationDate ? c.terminationDate.getTime() : Infinity
        });
      }
    }
    if (!cupsWindows.has(base)) cupsWindows.set(base, []);
    cupsWindows.get(base)!.push(...windows);
  }

  let totalRaw = 0;
  let activeRaw = 0;
  let skippedRaw = 0;

  for (const c of curves) {
    const base = c.cups.length === 22 ? c.cups.substring(0, 20) : c.cups;
    const windows = cupsWindows.get(base) || [];
    
    let sum = 0;
    for (const r of c.readings) sum += r || 0;
    
    totalRaw += sum;

    let isActive = false;
    for (const w of windows) {
      if (d.getTime() >= w.start && d.getTime() <= w.end) {
        isActive = true; break;
      }
    }

    if (isActive) {
      activeRaw += sum;
    } else {
      skippedRaw += sum;
    }
  }

  console.log(`For 2026-01-15:`);
  console.log(`Total LoadCurve Energy: ${totalRaw / 1000} MWh`);
  console.log(`Active Energy (Aggregated): ${activeRaw / 1000} MWh`);
  console.log(`Skipped Energy (Not Active): ${skippedRaw / 1000} MWh`);
}

run().then(() => prisma.$disconnect());
