import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function run() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { cups: { startsWith: 'ES0031405446869086QD' } }
  });
  console.log('F1 ID:', f1?.id);
  
  // Call internal billing engine for this F1 and just catch the first hour computation!
  // I will just use the code from InternalBillingEngine to see the formula
}
run();
