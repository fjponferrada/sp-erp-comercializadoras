import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
  const f1 = await prisma.f1Invoice.findUnique({
    where: { id: 'cmrahmwmr006604k23i2dawyd' },
    include: { contract: { include: { product: true } }, supplyPoint: true }
  });

  const engine = (InternalBillingEngine as any);
  
  // just monkeypatch the method or let's look at the raw invoice dates
  console.log("f1.fechaInicio:", f1.fechaInicio);
  console.log("f1.fechaFin:", f1.fechaFin);
}
main().finally(() => prisma.$disconnect());
