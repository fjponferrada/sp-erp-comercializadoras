import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function run() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { supplyPoint: { cups: { startsWith: 'ES0031405446869086QD' } } }
  });
  if (!f1) return console.log('F1 not found');
  
  // Call internal billing engine with returnHourlyDetails = true
  const result = await InternalBillingEngine.calculate(f1.id, true, true);
  
  // Let's find hour 0 of 2026-06-01
  const h0 = result.hourlyDetails?.find((h: any) => h.date.startsWith('2026-06-01T00:'));
  console.log('Hourly details for Hour 0:', JSON.stringify(h0, null, 2));

  // Let's calculate the average P3 price
  const p3Breakdown = result.periods['P3'];
  console.log('P3 Breakdown:', p3Breakdown);
  console.log('P3 Effective Price:', p3Breakdown.energyCostEur / p3Breakdown.f1ConsumptionMWh);
}
run();
