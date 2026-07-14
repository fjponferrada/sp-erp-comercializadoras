import { prisma } from '../src/lib/prisma';

async function main() {
  const f1Invoices = await prisma.f1Invoice.count();
  const f1Unlinked = await prisma.f1Invoice.count({
    where: { supplyPointId: null }
  });

  console.log(`F1 Invoices: ${f1Invoices} total, ${f1Unlinked} sin punto de suministro vinculado`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
