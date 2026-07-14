import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const targetMonthStart = new Date('2025-08-01T00:00:00Z');
  const targetMonthEnd = new Date('2025-08-31T23:59:59Z');

  console.log('Agrupando CCH por origen para Agosto 2025...');
  
  const sources = await prisma.loadCurve.groupBy({
    by: ['source'],
    where: {
      date: { gte: targetMonthStart, lte: targetMonthEnd }
    },
    _count: {
      source: true
    }
  });

  console.log(sources);
}

main().catch(console.error).finally(() => prisma.$disconnect());
