const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const leads = await prisma.lead.findMany({ take: 2 });
  console.log(JSON.stringify(leads, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
