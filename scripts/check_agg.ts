import { prisma } from '../src/lib/prisma';
import { format, subMonths, startOfMonth } from 'date-fns';

async function check() {
  const minMax = await prisma.aggregatedLoadCurve.aggregate({
    _min: { date: true },
    _max: { date: true },
    _count: true
  });
  console.log('--- Resumen General ---');
  console.log('Min Date:', minMax._min.date);
  console.log('Max Date:', minMax._max.date);
  console.log('Total Rows:', minMax._count);

  const eighteenMonthsAgo = subMonths(new Date(), 18);
  console.log(`\\nBuscando huecos desde ${format(eighteenMonthsAgo, 'yyyy-MM-dd')}...`);

  // Agrupación por mes para ver densidad
  const result = await prisma.$queryRaw`
    SELECT date_trunc('month', date) as mes, count(*) as conteo
    FROM "AggregatedLoadCurve"
    WHERE date >= ${eighteenMonthsAgo}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  console.log(result);

  await prisma.$disconnect();
}
check();
