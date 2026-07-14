import { prisma } from '../src/lib/prisma';
async function main() {
  const invoices = await prisma.internalInvoice.findMany({
    where: { supplyPoint: { cups: { contains: 'ES0031105546437024DF0F' } } },
    select: { id: true, startDate: true, endDate: true, excedentesKwh: true, excedentesAutoconsumo: true, isFixed: true }
  });
  console.log(invoices.map(i => ({...i, pexc: i.excedentesKwh ? (i.excedentesAutoconsumo / i.excedentesKwh) : 0 })));
}
main().finally(() => prisma.$disconnect());
