import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const dsvPrices = await prisma.systemComponentPrice.findMany({
    where: {
      component: 'DSV',
      date: { gte: new Date('2026-03-01'), lte: new Date('2026-03-31') }
    }
  });

  console.log(`Found ${dsvPrices.length} records for DSV.`);
  for (const p of dsvPrices.slice(0, 5)) {
    console.log(p.date, p.values.slice(0, 5));
  }
}
main().finally(() => prisma.$disconnect());
