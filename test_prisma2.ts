import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const l = await prisma.lead.findFirst({
    where: { airtableId: { not: null } },
    include: { contract: true }
  });
  console.log(JSON.stringify(l, null, 2));
}
run().finally(() => prisma.$disconnect());
