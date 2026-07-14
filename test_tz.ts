import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { format } from 'date-fns';

async function main() {
  const currentMonthStart = new Date('2026-03-01T00:00:00Z');
  const currentMonthEnd = new Date('2026-03-31T23:59:59Z');

  const reganecuMatricialRecords = await prisma.reganecuData.findMany({
    where: {
      date: { gte: currentMonthStart, lte: currentMonthEnd },
      cierre: 'C2',
      matricial: true,
      resolution: { in: ['H', 'QH'] }
    }
  });

  for (const matRecord of reganecuMatricialRecords) {
    console.log(`DB date: ${matRecord.date.toISOString()} -> dayKey: ${format(matRecord.date, 'yyyy-MM-dd')}`);
  }
}
main().finally(() => prisma.$disconnect());
