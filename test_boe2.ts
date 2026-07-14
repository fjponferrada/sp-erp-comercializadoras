import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { getPeriodoREE } from './src/lib/services/InternalBillingEngine';

async function check() {
  const perdidasBOE = await prisma.regulatedCost.findMany({
    where: { concept: 'PERDIDAS' }
  });
  const boeByTariff = new Map<string, any>();
  for (const b of perdidasBOE) {
    boeByTariff.set(b.tariff, b);
  }

  const dateObjH = new Date('2026-03-01T00:00:00Z');
  const periodStr = getPeriodoREE(dateObjH, '2.0TD');
  const boe = boeByTariff.get('2.0TD');
  console.log('boe', boe);
  console.log('periodStr', periodStr);
  const pVal = boe[periodStr.toLowerCase() as keyof typeof boe] as number | null;
  console.log('pVal', pVal);
}

check().finally(() => prisma.$disconnect());
