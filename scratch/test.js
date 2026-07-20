require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.findFirst({
    where: { vatNumber: '34001966P' }
  });
  console.log(JSON.stringify(client, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
