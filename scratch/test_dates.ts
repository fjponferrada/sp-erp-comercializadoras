import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });
import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function test() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { contract: { supplyPoint: { cups: 'ES0031405446869086QD0F' } } }
  });
  console.log("F1 fechaInicio:", f1.fechaInicio.toISOString());
  console.log("F1 fechaFin:", f1.fechaFin.toISOString());
}

test().catch(console.error).finally(() => prisma.$disconnect());
