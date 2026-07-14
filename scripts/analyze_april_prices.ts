import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { getPeriodoREE } from '../src/lib/utils/ree-periods'; // Might not be available, let's just do a simple check

async function main() {
  const startStr = '2026-04-01T00:00:00Z';
  const endStr = '2026-04-30T23:59:59Z';
  const start = new Date(startStr);
  const end = new Date(endStr);

  const prices = await prisma.systemComponentPrice.findMany({
    where: {
      date: { gte: start, lte: end },
      component: { in: ['DSV_SUBIR', 'DSV_BAJAR'] }
    }
  });

  let sumSubir = 0;
  let countSubir = 0;
  let maxSubir = 0;
  let minSubir = 9999;

  let sumBajar = 0;
  let countBajar = 0;

  for (const p of prices) {
    if (p.component === 'DSV_SUBIR') {
      for (const val of p.values) {
        sumSubir += val;
        countSubir++;
        if (val > maxSubir) maxSubir = val;
        if (val < minSubir) minSubir = val;
      }
    } else if (p.component === 'DSV_BAJAR') {
      for (const val of p.values) {
        sumBajar += val;
        countBajar++;
      }
    }
  }

  console.log(`=== PRECIOS HORARIOS DE DESVÍOS EN BASE DE DATOS (ABRIL 2026) ===`);
  console.log(`Desvío a Subir: Media = ${(sumSubir/countSubir).toFixed(2)} €/MWh | Max = ${maxSubir.toFixed(2)} €/MWh | Min = ${minSubir.toFixed(2)} €/MWh`);
  console.log(`Desvío a Bajar: Media = ${(sumBajar/countBajar).toFixed(2)} €/MWh`);

  // Let's also check Reganecu C2 hourly data to see what we compared against
  const aggCad = await prisma.reganecuData.findMany({
    where: {
      date: { gte: start, lte: end },
      matricial: true,
      cierre: 'C2',
      component: 'CAD' // CAD matricial is what calculate_pending uses
    }
  });

  let sumLiquidatedC2 = 0;
  for (const r of aggCad) {
    sumLiquidatedC2 += (r.jsonData as any).values?.reduce((a:number,b:number)=>a+b, 0) || 0;
  }
  console.log(`\nEnergía liquidada horaria total en C2 (según Reganecu matricial CAD): ${sumLiquidatedC2.toFixed(2)} MWh`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
