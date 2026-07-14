import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sp = await prisma.supplyPoint.findFirst({
    where: { cups: { startsWith: 'ES0031101498164002PH' } },
    include: { contracts: true }
  });
  console.log(JSON.stringify(sp, null, 2));
}

main().finally(() => prisma.$disconnect());
