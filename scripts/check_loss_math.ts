import { prisma } from '../src/lib/prisma';
import { format } from 'date-fns';

async function run() {
  const d = new Date('2026-01-01T00:00:00.000Z');
  
  const perdidasBOE = await prisma.regulatedCost.findMany({ where: { concept: 'PERDIDAS' } });
  const boeByTariff = new Map<string, any>();
  for (const b of perdidasBOE) boeByTariff.set(b.tariff, b);
  
  console.log('BOE:', boeByTariff);

  const kFactors = await prisma.systemComponentPrice.findFirst({
    where: { date: d, component: 'K' }
  });
  console.log('K:', kFactors?.values);
}

run().then(() => prisma.$disconnect());
