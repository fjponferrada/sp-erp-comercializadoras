import { prisma } from './src/lib/prisma';
async function run() {
  const comp = await prisma.company.findFirst({ where: { name: { contains: 'AED' } } });
  
  const sp = await prisma.supplyPoint.findMany({
    select: { tariff: true },
    where: { client: { is: { companyId: comp!.id } } }
  });
  
  const groups = sp.reduce((acc, curr) => {
    acc[curr.tariff] = (acc[curr.tariff] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log("SupplyPoint Tariffs for AED:", groups);
}
run().finally(() => prisma.$disconnect());
