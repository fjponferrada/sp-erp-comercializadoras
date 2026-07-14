import { prisma } from '../src/lib/prisma';
import { startOfDay } from 'date-fns';

async function run() {
  const dStr = '2026-01-15T00:00:00.000Z';
  const targetDate = new Date(dStr);
  const time = targetDate.getTime();

  // 1. Get all active SupplyPoints on this date
  const sps = await prisma.supplyPoint.findMany({
    select: { cups: true, contracts: { select: { activationDate: true, terminationDate: true, status: true } } }
  });

  let activeCount = 0;
  const activeCups = new Set<string>();

  for (const sp of sps) {
    let isActive = false;
    for (const c of sp.contracts) {
      if (c.status === 'ACTIVE' || c.status === 'PENDING_ACTIVATION') {
        const start = c.activationDate ? startOfDay(c.activationDate).getTime() : null;
        const end = c.terminationDate ? startOfDay(c.terminationDate).getTime() : null;
        if (start && time >= start) {
          if (!end || time <= end) {
            isActive = true;
            break;
          }
        }
      }
    }
    if (isActive) {
      activeCount++;
      activeCups.add(sp.cups.length === 22 ? sp.cups.substring(0, 20) : sp.cups);
    }
  }

  // 2. Get all LoadCurves for this date
  const curves = await prisma.loadCurve.findMany({
    where: { date: targetDate },
    select: { cups: true }
  });

  let cchCount = 0;
  const cchCups = new Set<string>();
  for (const c of curves) {
    const base = c.cups.length === 22 ? c.cups.substring(0, 20) : c.cups;
    cchCups.add(base);
    if (activeCups.has(base)) {
      cchCount++;
    }
  }

  console.log(`--- Date: ${dStr} ---`);
  console.log(`Active CUPS in Database: ${activeCount}`);
  console.log(`CUPS with CCH data for this date: ${cchCups.size}`);
  console.log(`Active CUPS that HAVE CCH data: ${cchCount}`);
  console.log(`Missing CCH percentage: ${((activeCount - cchCount) / activeCount * 100).toFixed(2)}%`);
}

run().then(() => prisma.$disconnect());
