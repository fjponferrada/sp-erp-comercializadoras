import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { format } from 'date-fns';

async function main() {
  const dsvPrices = await prisma.systemComponentPrice.findMany({
    where: {
      component: 'DSV',
      date: { gte: new Date('2026-03-01'), lte: new Date('2026-03-31') }
    }
  });

  let totalSum = 0;
  let count = 0;
  for (const d of dsvPrices) {
    for (const v of d.values) {
      if (v !== null && v !== undefined) {
        totalSum += v;
        count++;
      }
    }
  }
  
  console.log(`Average System DSV price: ${count > 0 ? totalSum / count : 0}`);
}
main().finally(() => prisma.$disconnect());
