import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { format } from 'date-fns';

async function main() {
  const matRecords = await prisma.reganecuData.findMany({
    where: {
      date: { gte: new Date('2026-03-01'), lte: new Date('2026-03-02') },
      cierre: 'C2',
      matricial: true,
      resolution: { in: ['H', 'QH'] }
    }
  });

  for (const doc of matRecords) {
    const jData = doc.jsonData as any[];
    if (!Array.isArray(jData)) continue;
    
    for (const item of jData.slice(0, 50)) {
      if (item.concept === 'DSV' || item.concept === 'DVS') {
        console.log(`Period ${item.period}:`, item);
      }
    }
  }
}
main().finally(() => prisma.$disconnect());
