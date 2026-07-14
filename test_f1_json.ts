import { prisma } from './src/lib/prisma';

async function main() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { id: "cmqgjfirk0005p841sr3flrsx" }
  });
  console.log(JSON.stringify(f1?.jsonData, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
