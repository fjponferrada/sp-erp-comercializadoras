import { prisma } from '../src/lib/prisma';
async function main() {
  const profiles = await prisma.reeProfile.findMany({ where: { month: 6 } });
  let totalSolar = 0;
  
  const omieMap = new Map();
  const omieData = await prisma.systemComponentPrice.findMany({
    where: {
      date: { gte: new Date('2026-06-01T00:00:00Z'), lte: new Date('2026-06-30T00:00:00Z') },
      component: 'OMIE'
    }
  });

  for (const pd of omieData) {
    const isQuarterly = pd.values.length >= 96;
    for (let i = 0; i < (isQuarterly ? 96 : 24); i++) {
        if (!isQuarterly) {
            omieMap.set(`${pd.date.toISOString().split('T')[0]}_${i}`, pd.values[i] || 0);
        }
    }
  }

  let totalOmieWeighted = 0;
  let totalCoef = 0;
  let missing = 0;
  for (const p of profiles) {
      if (p.pSolar > 0) {
          const dateStr = `2026-06-${p.day.toString().padStart(2, '0')}`;
          const val = omieMap.get(`${dateStr}_${p.hour}`);
          if (val !== undefined) {
             totalOmieWeighted += val * p.pSolar;
             totalCoef += p.pSolar;
          } else {
             missing++;
          }
      }
  }

  console.log("Avg OMIE weighted by pSolar in June:", totalCoef > 0 ? totalOmieWeighted / totalCoef : 0);
  console.log("Missing OMIE hours:", missing);
}
main().finally(() => prisma.$disconnect());
