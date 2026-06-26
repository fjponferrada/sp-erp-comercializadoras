const { prisma } = require('./src/lib/prisma');

async function main() {
  const ppas = await prisma.ppa.findMany();
  console.log("PPAS:", JSON.stringify(ppas, null, 2));
  
  const sps = await prisma.supplyPoint.findMany();
  console.log("SPS:", sps.length);
}
main().finally(() => prisma.$disconnect());
