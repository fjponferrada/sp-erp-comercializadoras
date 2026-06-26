const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

async function main() {
  const futuros = await prisma.futurePrice.findMany();
  console.log("Future Prices:", futuros);
  
  const omie = await prisma.portfolioBaseCurve.findMany({
    take: 24,
    orderBy: { datetime: 'asc' }
  });
  console.log("First 24h of Portfolio:", omie.map(o => o.basePriceEurMwh));
}
main();
