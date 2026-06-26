import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.systemComponentPrice.count({
    where: { component: 'OMIE' }
  });
  console.log("OMIE RECORD COUNT:", c);
  
  if (c > 0) {
    const first = await prisma.systemComponentPrice.findFirst({
      where: { component: 'OMIE' }
    });
    console.log("FIRST:", first);
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
