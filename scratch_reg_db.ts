import * as dotenv from 'dotenv';
dotenv.config();
import { prisma } from './src/lib/prisma';

async function main() {
  const regs = await prisma.regulatedCost.findMany({
    where: {
      OR: [{ tariff: '2.0TD' }, { tariff: 'TODAS' }]
    }
  });
  console.table(regs.map(r => ({
    concept: r.concept,
    validFrom: r.validFrom,
    validTo: r.validTo,
    p1: r.p1, p2: r.p2, p3: r.p3, p4: r.p4, p5: r.p5, p6: r.p6,
    singleValue: r.singleValue
  })));
}
main();
