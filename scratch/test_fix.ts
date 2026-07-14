import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });
import { prisma } from '../src/lib/prisma';
import { fromZonedTime } from 'date-fns-tz';

async function test() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { contract: { supplyPoint: { cups: 'ES0031405446869086QD0F' } } }
  });
  
  const f1StartIsoStr = f1.fechaInicio.toISOString().substring(0, 10);
  const startDate = fromZonedTime(`${f1StartIsoStr}T00:00:00`, 'Europe/Madrid');
  
  const f1EndIsoStr = f1.fechaFin.toISOString().substring(0, 10);
  const endMidnight = fromZonedTime(`${f1EndIsoStr}T00:00:00`, 'Europe/Madrid');
  const endDate = new Date(endMidnight.getTime() + 24 * 3600 * 1000);
  
  console.log("f1.fechaInicio DB:", f1.fechaInicio.toISOString());
  console.log("Fixed startDate:", startDate.toISOString());
  console.log("Fixed endDate:", endDate.toISOString());
}

test().catch(console.error).finally(() => prisma.$disconnect());
