import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function run() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { supplyPoint: { cups: { startsWith: 'ES0031405446869086QD' } } }
  });
  if (!f1) return console.log('F1 not found');
  
  const result = await InternalBillingEngine.calculate(f1.id, true, true);
  
  console.log('P1 Effective Price:', result.periods['P1'].energyCostEur / result.periods['P1'].f1ConsumptionMWh);
  console.log('P2 Effective Price:', result.periods['P2'].energyCostEur / result.periods['P2'].f1ConsumptionMWh);
  console.log('P3 Effective Price:', result.periods['P3'].energyCostEur / result.periods['P3'].f1ConsumptionMWh);
  console.log('P4 Effective Price:', result.periods['P4'].energyCostEur / result.periods['P4'].f1ConsumptionMWh);
  console.log('P5 Effective Price:', result.periods['P5'].energyCostEur / result.periods['P5'].f1ConsumptionMWh);
  console.log('P6 Effective Price:', result.periods['P6'].energyCostEur / result.periods['P6'].f1ConsumptionMWh);
}
run();
