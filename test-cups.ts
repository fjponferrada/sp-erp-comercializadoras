import { prisma } from './src/lib/prisma';

async function main() {
  const sp = await prisma.supplyPoint.findFirst({
    where: { cups: { startsWith: 'ES0022000007942973' } }
  });
  console.log(sp);
}

main().finally(() => prisma.$disconnect());
