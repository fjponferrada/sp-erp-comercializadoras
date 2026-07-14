const { prisma } = require('./src/lib/prisma');

async function run() {
  const d = await prisma.internalInvoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(d, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
