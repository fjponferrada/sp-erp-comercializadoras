import { prisma } from './src/lib/prisma';
async function run() {
  const comp = await prisma.company.findFirst({ where: { name: { contains: 'AED' } } });
  const aedId = comp!.id;
  
  const count = await prisma.aggregatedLoadCurve.count({ where: { companyId: null } });
  console.log(`Found ${count} records with null companyId.`);
  
  if (count > 0) {
    const res = await prisma.aggregatedLoadCurve.updateMany({
      where: { companyId: null },
      data: { companyId: aedId }
    });
    console.log(`Updated ${res.count} records.`);
  }
}
run().finally(() => prisma.$disconnect());
