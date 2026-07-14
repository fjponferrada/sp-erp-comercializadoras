import { prisma } from './src/lib/prisma';
async function run() {
  const comp = await prisma.company.findFirst({ where: { name: { contains: 'AED' } } });
  const aedId = comp!.id;
  
  const reganecuMatches = await prisma.reganecuData.count({ where: { companyId: aedId } });
  const aggMatches = await prisma.aggregatedLoadCurve.count({ where: { companyId: aedId } });
  console.log(`ReganecuData for AED: ${reganecuMatches}`);
  console.log(`AggregatedLoadCurve for AED: ${aggMatches}`);
}
run().finally(() => prisma.$disconnect());
