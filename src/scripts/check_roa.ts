import { prisma } from '../lib/prisma';

async function check() {
  const sp = await prisma.supplyPoint.findFirst({
    where: { cups: { startsWith: 'ES0031101348602003' } },
    include: {
      client: true,
      contracts: {
        orderBy: { createdAt: 'desc' },
        include: { product: true }
      }
    }
  });

  if (!sp) {
    console.log("No SP found");
    return;
  }
  console.log("Client:", sp.client?.name);
  for (const c of sp.contracts) {
    console.log(`\nContract ID: ${c.id}`);
    console.log(`Status: ${c.status}`);
    console.log(`Dates: ${c.startDate} to ${c.endDate}`);
    console.log(`Activation/Termination: ${c.activationDate} to ${c.terminationDate}`);
    console.log(`Product: ${c.product?.name} (Type: ${c.product?.type})`);
    console.log(`Prices: P1E=${c.p1e}, P2E=${c.p2e}, P6E=${c.p6e}, Fee=${c.feeValue}`);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
