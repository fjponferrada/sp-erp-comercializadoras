import { prisma } from './src/lib/prisma';

async function main() {
  const sums = await prisma.pendingEnergySummary.findMany({
    orderBy: { month: 'asc' }
  });
  console.log('Month | Pend MWh | Est Cost (Eur)');
  console.log('---------------------------------');
  for (const sum of sums) {
    console.log(`${sum.month} | ${sum.pendingMwh.toFixed(2).padStart(8)} | ${sum.estimatedPendingCostEur.toFixed(2).padStart(12)}`);
  }
}
main().finally(() => prisma.$disconnect());
