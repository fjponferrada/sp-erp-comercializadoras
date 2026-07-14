import { prisma } from './src/lib/prisma';
async function run() {
  const aggNull = await prisma.aggregatedLoadCurve.count({ where: { companyId: null } });
  const aggNotNull = await prisma.aggregatedLoadCurve.count({ where: { companyId: { not: null } } });
  console.log("AggregatedLoadCurve companyId:", { null: aggNull, notNull: aggNotNull });

  const regNull = await prisma.reganecuData.count({ where: { companyId: null } });
  const regNotNull = await prisma.reganecuData.count({ where: { companyId: { not: null } } });
  console.log("ReganecuData companyId:", { null: regNull, notNull: regNotNull });
}
run().finally(() => prisma.$disconnect());
