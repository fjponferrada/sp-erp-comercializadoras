import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });
import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function test() {
  const draft = await prisma.internalInvoice.findFirst({
    where: { contract: { supplyPoint: { cups: 'ES0031405446869086QD0F' } } }
  });
  const res = await InternalBillingEngine.calculate(draft.f1InvoiceId, false, true);
  console.log("Calculated Total MWh:", res.totalCchMWh);
  console.log("Calculated Total kWh:", res.totalCchMWh * 1000);
  console.log("Length:", res.hourlyDetails?.length);
  console.log("energyCost:", res.energyCost);
}

test().catch(console.error).finally(() => prisma.$disconnect());
