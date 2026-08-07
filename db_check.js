const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDB() {
  const start = new Date('2026-08-06T00:00:00Z');
  const regulated = await prisma.regulatedCost.findMany({
    where: {
      OR: [{ tariff: '2.0TD' }, { tariff: 'TODAS' }],
      validFrom: { lte: start },
      validTo: { gte: start }
    }
  });

  console.log('Regulated Costs for 2026-08-06:');
  console.log(regulated);

  const startJuly = new Date('2026-07-13T00:00:00Z');
  const regulatedJuly = await prisma.regulatedCost.findMany({
    where: {
      OR: [{ tariff: '2.0TD' }, { tariff: 'TODAS' }],
      validFrom: { lte: startJuly },
      validTo: { gte: startJuly }
    }
  });

  console.log('\nRegulated Costs for 2026-07-13:');
  console.log(regulatedJuly);
  
  // also check if someone swapped p1, p2, p3 values...
}

checkDB().catch(console.error).finally(() => prisma.$disconnect());
