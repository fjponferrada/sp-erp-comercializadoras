import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cups = 'ES0031103121712032YJ0F';
  const sps = await prisma.supplyPoint.findMany({
    where: { cups },
    include: {
      client: true,
      contracts: {
        orderBy: { activationDate: 'desc' },
        include: { client: true }
      }
    }
  });

  console.log(`Found ${sps.length} SupplyPoints for CUPS ${cups}`);
  
  for (let i = 0; i < sps.length; i++) {
    const sp = sps[i];
    console.log(`\n--- SP ${i} (ID: ${sp.id}) ---`);
    console.log(`SP.Client: ${sp.client?.businessName || sp.client?.firstName + ' ' + sp.client?.lastName}`);
    console.log(`Contracts: ${sp.contracts.length}`);
    for (const c of sp.contracts) {
      console.log(` - Contract ${c.id} | Status: ${c.status} | Act: ${c.activationDate} | Term: ${c.terminationDate} | Client: ${c.client?.firstName} ${c.client?.lastName}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
