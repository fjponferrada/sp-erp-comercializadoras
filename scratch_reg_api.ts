import { prisma } from './src/lib/prisma';
async function main() {
  const start = new Date('2026-06-26T00:00:00Z');
  const regulated = await prisma.regulatedCost.findMany({
    where: {
      OR: [{ tariff: '2.0TD' }, { tariff: 'TODAS' }],
      validFrom: { lte: start },
      validTo: { gte: start }
    }
  });
  console.log("Matched Regulated Costs:");
  regulated.forEach(r => console.log(r.concept, r.tariff, r.p1, r.p2, r.p3, r.singleValue));
}
main();
