import { prisma } from '../src/lib/prisma';

async function main() {
  const types = await prisma.contract.findMany({
    where: { version: { gt: 0 } },
    distinct: ['tramitationType'],
    select: { tramitationType: true }
  });
  console.log('Tramitation types for version > 0:', types.map(t => t.tramitationType));
}

main().finally(() => prisma.$disconnect());
