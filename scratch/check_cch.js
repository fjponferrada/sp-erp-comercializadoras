const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cups = 'ES0031405446869086QD0F';
  const cchs = await prisma.cCH.findMany({
    where: {
      supplyPoint: {
        cups: cups
      },
      date: {
        gte: new Date('2026-05-31'),
        lte: new Date('2026-06-30')
      }
    },
    orderBy: {
      date: 'asc'
    }
  });

  console.log(`Found ${cchs.length} CCH records for CUPS ${cups} in June 2026.`);
  
  if (cchs.length > 0) {
    let totalConsumo = 0;
    cchs.forEach(c => totalConsumo += Number(c.consumptionKwh));
    console.log(`Total consumption in DB: ${totalConsumo} kWh`);
    
    // show first 5 CCH
    console.log("First 5 records:");
    cchs.slice(0, 5).forEach(c => {
      console.log(`Date: ${c.date.toISOString()}, Hour: ${c.hour}, Period: ${c.periodId}, Consumo: ${c.consumptionKwh}`);
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
