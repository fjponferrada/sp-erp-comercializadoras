import { prisma } from './src/lib/prisma';

async function main() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { id: "cmqlldzcv00047841wcchb24j" },
    include: { contract: true }
  });
  console.log("F1 Total:", f1?.totalAmount);
  console.log("F1 Base:", f1?.baseImponible);
  
  const contract = f1?.contract as any;
  console.log("Contract Fee:", contract?.fee);
  console.log("AirtableData:", JSON.stringify(contract?.airtableData, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
