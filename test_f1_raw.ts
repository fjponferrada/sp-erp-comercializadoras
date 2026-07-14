import { prisma } from './src/lib/prisma';

async function main() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { id: "cmqpp254u000qhw41zjc50uls" }
  });
  console.log("F1 Raw:", f1);
}

main().catch(console.error).finally(() => prisma.$disconnect());
