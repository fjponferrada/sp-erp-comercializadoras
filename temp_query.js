const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contract.findFirst({
    where: { client: { businessName: { contains: 'colodrero', mode: 'insensitive' } } },
    include: { supplyPoint: true, invoices: true, lead: true }
  });
  console.log(JSON.stringify(c, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
