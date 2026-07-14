import { prisma } from '../src/lib/prisma';
async function run() {
  const d = new Date('2026-01-15T00:00:00.000Z');
  
  const curves = await prisma.loadCurve.findMany({ where: { date: d } });
  
  let pklSum = 0;
  let pklCount = 0;
  let localSum = 0;
  let localCount = 0;

  for (const c of curves) {
    let sum = 0;
    for (const r of c.readings) sum += r || 0;
    
    if (c.source === 'MIGRACION_PKL') {
      pklSum += sum;
      pklCount++;
    } else {
      localSum += sum;
      localCount++;
    }
  }

  console.log(`For 2026-01-15:`);
  console.log(`MIGRACION_PKL: ${pklCount} records, ${pklSum / 1000} MWh`);
  console.log(`LOCAL_SCAN: ${localCount} records, ${localSum / 1000} MWh`);
  console.log(`Total DB MWh: ${(pklSum + localSum) / 1000} MWh`);
}
run().then(() => prisma.$disconnect());
