import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function run() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { supplyPoint: { cups: { startsWith: 'ES0031405446869086QD' } } }
  });
  if (!f1) return console.log('F1 not found');
  
  const result = await InternalBillingEngine.calculate(f1.id, true, true);
  
  // Find a P3 hour
  const p3Hour = result.hourlyDetails?.find((h: any) => h.period === 'P3' && h.date.startsWith('2026-06-01'));
  console.log('Hourly details for a P3 Hour:', JSON.stringify(p3Hour, null, 2));
}
run();
