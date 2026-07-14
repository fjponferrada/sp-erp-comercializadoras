import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const perds = await prisma.omiePrice.findMany({
    where: { component: 'PERD_20TD' },
    take: 5
  });
  console.log("PERD_20TD values:", perds.map(p => p.values.slice(0, 3)));
}

main().catch(console.error).finally(() => prisma.$disconnect());
