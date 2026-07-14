const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contract.findFirst({
    where: { contractCode: { contains: '24451235B0F' } },
    include: { supplyPoint: true, invoices: true, lead: true, client: true }
  });
  console.log(JSON.stringify(c, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());
