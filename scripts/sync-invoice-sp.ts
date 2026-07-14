import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log("Sincronizando supplyPointId de las facturas con sus contratos...");
  const invoices = await prisma.invoice.findMany({
    where: { contractId: { not: null } },
    select: { id: true, supplyPointId: true, contract: { select: { supplyPointId: true } } }
  });

  let updated = 0;
  for (const inv of invoices) {
    if (inv.contract && inv.contract.supplyPointId !== inv.supplyPointId) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { supplyPointId: inv.contract.supplyPointId }
      });
      updated++;
    }
  }

  console.log(`Facturas sincronizadas: ${updated}`);
}

main().finally(() => prisma.$disconnect());
