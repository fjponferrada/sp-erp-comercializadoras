import { prisma } from './src/lib/prisma';
import { format } from 'date-fns';

async function main() {
  const sum = await prisma.pendingEnergySummary.findFirst({
    where: { month: '2026-03' }
  });
  console.log(sum);
}
main().finally(() => prisma.$disconnect());
