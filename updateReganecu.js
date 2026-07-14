const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  const aed = await prisma.company.findFirst({
    where: { name: { contains: 'AED', mode: 'insensitive' } }
  });
  
  if (!aed) {
    console.log('Company AED not found');
    return;
  }
  
  const res = await prisma.reganecuData.updateMany({
    where: { companyId: null },
    data: { companyId: aed.id }
  });
  
  console.log(`Updated ${res.count} records to company ${aed.name} (${aed.id})`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
