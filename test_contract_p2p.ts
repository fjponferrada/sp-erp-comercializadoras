import { prisma } from './src/lib/prisma';

async function main() {
  const c = await prisma.contract.findUnique({
    where: { id: "cmq702ohe1ektic41j3qakk8q" }
  });
  console.log("P1E:", c?.p1e, "P1P:", c?.p1p);
  console.log("P2E:", c?.p2e, "P2P:", c?.p2p);
  console.log("P3E:", c?.p3e, "P3P:", c?.p3p);
}

main().catch(console.error).finally(() => prisma.$disconnect());
