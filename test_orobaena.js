const { prisma } = require('./src/lib/prisma');
const { InternalBillingEngine } = require('./src/lib/services/InternalBillingEngine');

async function run() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { supplyPoint: { cups: { contains: 'ES0031101498164002PH0F' } } },
    orderBy: { createdAt: 'desc' }
  });
  
  const c = await prisma.contract.findFirst({
    where: { supplyPoint: { cups: { contains: 'ES0031101498164002PH0F' } } }
  });

  console.log('Contract pricingModel:', c?.pricingModel);
  console.log('Contract Prices:', { p1e: c?.p1e, p2e: c?.p2e, p3e: c?.p3e, p4e: c?.p4e, p5e: c?.p5e, p6e: c?.p6e });
  
  const result = await InternalBillingEngine.calculate(f1.id);
  
  console.log('\n--- Energy Market Details ---');
  console.log(JSON.stringify(result.energyMarketDetails, null, 2));

  console.log('\n--- F1 Readings ---');
  console.log(JSON.stringify(result.f1Readings, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
