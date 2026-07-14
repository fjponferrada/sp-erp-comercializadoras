import { prisma } from '../src/lib/prisma';
async function main() {
  const prices = await prisma.systemComponentPrice.findMany({
    where: {
      component: 'OMIE',
      date: { gte: new Date('2026-06-01'), lte: new Date('2026-06-30T23:59:59Z') },
    }
  });
  
  let sum = 0;
  let count = 0;
  for (const p of prices) {
    const h = p.date.getHours();
    if (h >= 10 && h <= 19) {
      sum += p.value;
      count++;
    }
  }
  
  console.log("Avg OMIE during solar hours:", count > 0 ? (sum / count) : 0);
  console.log("Count:", count);
}
main().finally(() => prisma.$disconnect());
