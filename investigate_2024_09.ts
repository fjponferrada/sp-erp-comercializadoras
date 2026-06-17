import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function run() {
  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] }
    },
    select: {
      id: true,
      activationDate: true,
      terminationDate: true,
      supplyPointId: true,
      supplyPoint: {
        select: { cups: true, annualConsumption: true }
      }
    }
  });

  const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
  const altasData: Record<string, any[]> = {};

  const contractsByCups: Record<string, typeof contracts> = {};
  contracts.forEach(c => {
    if (!c.supplyPointId || !c.activationDate) return;
    if (!contractsByCups[c.supplyPointId]) contractsByCups[c.supplyPointId] = [];
    contractsByCups[c.supplyPointId].push(c);
  });

  Object.values(contractsByCups).forEach(cupsContracts => {
    cupsContracts.sort((a, b) => a.activationDate!.getTime() - b.activationDate!.getTime());

    let currentPeriod: any = null;
    const periods: any[] = [];

    for (const c of cupsContracts) {
      const mwh = c.supplyPoint?.annualConsumption || 0;
      
      if (!currentPeriod) {
        currentPeriod = { start: c.activationDate!, end: c.terminationDate || null, maxMwh: mwh, cups: c.supplyPoint?.cups, ids: [c.id] };
        continue;
      }

      const startNext = c.activationDate!;
      
      if (currentPeriod.end === null) {
        currentPeriod.maxMwh = mwh;
        currentPeriod.ids.push(c.id);
      } else {
        if (startNext.getTime() <= currentPeriod.end.getTime() + GRACE_PERIOD_MS) {
          if (!c.terminationDate) {
            currentPeriod.end = null;
          } else if (c.terminationDate.getTime() > currentPeriod.end.getTime()) {
            currentPeriod.end = c.terminationDate;
          }
          currentPeriod.maxMwh = mwh;
          currentPeriod.ids.push(c.id);
        } else {
          periods.push(currentPeriod);
          currentPeriod = { start: c.activationDate!, end: c.terminationDate || null, maxMwh: mwh, cups: c.supplyPoint?.cups, ids: [c.id] };
        }
      }
    }

    if (currentPeriod) {
      periods.push(currentPeriod);
    }

    periods.forEach(p => {
      const altaM = `${p.start.getFullYear()}-${String(p.start.getMonth() + 1).padStart(2, '0')}`;
      if (!altasData[altaM]) altasData[altaM] = [];
      altasData[altaM].push(p);
    });
  });

  const sep2024 = altasData['2024-09'] || [];
  let totalMwh = 0;
  sep2024.forEach(p => { totalMwh += p.maxMwh; });
  
  console.log(`Total Altas en 2024-09: ${sep2024.length} periodos`);
  console.log(`Total MWh en 2024-09: ${totalMwh}`);
  
  // Encontrar las más gordas
  sep2024.sort((a, b) => b.maxMwh - a.maxMwh);
  console.log("\nTop 10 Altas en 2024-09:");
  for (let i = 0; i < Math.min(10, sep2024.length); i++) {
    console.log(`${i+1}. CUPS: ${sep2024[i].cups} | MWh: ${sep2024[i].maxMwh} | Contratos: ${sep2024[i].ids.length}`);
  }
}

run().finally(() => prisma.$disconnect());
