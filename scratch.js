const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.contract.findFirst({
    where: { client: { businessName: { contains: 'LAURA ALOS' } } },
    include: { client: true, product: true }
  });
  console.log(JSON.stringify(c, null, 2));
}
main();
