import { prisma } from './src/lib/prisma';
async function run() {
  const comp = await prisma.company.findFirst({ where: { name: { contains: 'AED' } } });
  
  const tariffs = await prisma.supplyPoint.groupBy({
    by: ['tariff'],
    _count: { _all: true },
    where: { client: { companyId: comp!.id } }
  });
  console.log("SupplyPoint Tariffs:", tariffs);
}
run().finally(() => prisma.$disconnect());
