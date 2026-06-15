import { prisma } from './src/lib/prisma';

async function main() {
  const c = await prisma.contract.findFirst({
    where: { contractCode: 'AEDJPP2606141916AF0F' },
    include: { Lead: true }
  });
  console.log(JSON.stringify(c, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
