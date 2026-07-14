const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const contract = await prisma.contract.findFirst({
    where: { contractCode: 'AEDJPL26221622TF0F' },
    include: {
      Lead: true,
      client: true,
      supplyPoint: true,
      product: true
    }
  });
  console.log(JSON.stringify(contract, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
