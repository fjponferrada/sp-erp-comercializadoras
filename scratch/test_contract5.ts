import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function run() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { supplyPoint: { cups: { startsWith: 'ES0031405446869086QD' } } }
  });
  if (!f1) return console.log('F1 not found');
  
  const result = await InternalBillingEngine.calculate(f1.id, true, true);
  
  // Find all 4 quarters of Hour 9 Local Time (07:00 UTC)
  const q1 = result.hourlyDetails?.find((h: any) => h.date.startsWith('2026-06-01T07:00:'));
  const q2 = result.hourlyDetails?.find((h: any) => h.date.startsWith('2026-06-01T07:15:'));
  const q3 = result.hourlyDetails?.find((h: any) => h.date.startsWith('2026-06-01T07:30:'));
  const q4 = result.hourlyDetails?.find((h: any) => h.date.startsWith('2026-06-01T07:45:'));
  
  console.log('Q1 OMIE:', q1?.omie);
  console.log('Q2 OMIE:', q2?.omie);
  console.log('Q3 OMIE:', q3?.omie);
  console.log('Q4 OMIE:', q4?.omie);
}
run();
