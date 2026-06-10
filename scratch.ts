import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contract.findFirst({ where: { contractCode: 'PRPR24624149AD0F' } });
  console.log(c?.airtableId);
}
main().finally(() => prisma.$disconnect());
