import { prisma } from './src/lib/prisma';

async function main() {
  const c = await prisma.client.findFirst({ where: { vatNumber: '30205968E' } });
  console.dir(c, { depth: null });
}

main();
