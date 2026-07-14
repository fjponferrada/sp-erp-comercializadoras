import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: {
      contract: { supplyPoint: { cups: 'ES0031405446869086QD0F' } }
    },
    include: {
      contract: true,
      supplyPoint: true
    }
  });

  if (!f1) return console.log('no f1');

  // get prices for 2026-06-01
  const date = new Date('2026-06-01T00:00:00Z');
  const priceData = await prisma.systemComponentPrice.findMany({
    where: {
      date: date
    }
  });

  for (const pd of priceData) {
    if (['OMIE', 'OS', 'RESTRICCIONES', 'K', 'PERD_30TD'].includes(pd.component)) {
      console.log(pd.component, pd.values[0]); // hour 0
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
