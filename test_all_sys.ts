import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const prices = await prisma.systemComponentPrice.findMany({
    where: {
      date: { gte: new Date('2026-03-01'), lte: new Date('2026-03-31') }
    }
  });

  const avgs: Record<string, { sum: number, count: number }> = {};
  for (const d of prices) {
    if (!avgs[d.component]) avgs[d.component] = { sum: 0, count: 0 };
    for (const v of d.values) {
      if (v) {
        avgs[d.component].sum += v;
        avgs[d.component].count++;
      }
    }
  }
  
  for (const comp in avgs) {
    console.log(`Average ${comp}: ${avgs[comp].count > 0 ? avgs[comp].sum / avgs[comp].count : 0}`);
  }
}
main().finally(() => prisma.$disconnect());
