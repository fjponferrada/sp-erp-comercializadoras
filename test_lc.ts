import { prisma } from './src/lib/prisma';

async function test() {
  const lc = await prisma.loadCurve.findFirst();
  console.log(lc);
}
test().finally(() => prisma.$disconnect());
