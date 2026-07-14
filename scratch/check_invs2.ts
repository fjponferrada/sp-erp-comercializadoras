import { prisma } from '../src/lib/prisma';
async function main() {
  const invoices = await prisma.internalInvoice.findMany({
    where: { supplyPoint: { cups: { contains: 'ES0031105546437024DF0F' } } },
    select: { id: true, billingStart: true, billingEnd: true, excedentesKwh: true, excedentesAutoconsumo: true, isFixed: true }
  });
  console.log(invoices.map(i => ({
    start: i.billingStart?.toISOString().split('T')[0],
    end: i.billingEnd?.toISOString().split('T')[0],
    kwh: i.excedentesKwh,
    total: i.excedentesAutoconsumo,
    pexc: i.excedentesKwh ? (i.excedentesAutoconsumo / i.excedentesKwh) : 0
  })));
}
main().finally(() => prisma.$disconnect());
