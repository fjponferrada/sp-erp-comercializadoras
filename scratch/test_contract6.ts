import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function run() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { supplyPoint: { cups: { startsWith: 'ES0031405446869086QD' } } }
  });
  if (!f1) return console.log('F1 not found');
  
  const result = await InternalBillingEngine.calculate(f1.id, true, true);
  
  console.log('P4 Breakdown:', result.periods['P4']);
  console.log('P4 Effective Price:', result.periods['P4'].energyCostEur / result.periods['P4'].f1ConsumptionMWh);
}
run();
