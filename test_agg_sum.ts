import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function check() {
  const sum = await prisma.$queryRaw`
    SELECT sum(v) as sum 
    FROM "AggregatedLoadCurve", unnest("totalConsumption") as v 
    WHERE date >= '2026-03-01' AND date <= '2026-03-31'
  ` as any[];
  console.log('Total in AggregatedLoadCurve (March):', Number(sum[0].sum) / 1000, 'MWh');

  const lcSum = await prisma.$queryRaw`
    SELECT sum(v) as sum 
    FROM "LoadCurve", unnest("readings") as v 
    WHERE date >= '2026-03-01' AND date <= '2026-03-31'
  ` as any[];
  console.log('Total in LoadCurve (March):', Number(lcSum[0].sum) / 1000, 'MWh');
}
check().finally(() => prisma.$disconnect());
