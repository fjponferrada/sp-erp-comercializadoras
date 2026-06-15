const { PrismaClient } = require('@prisma/client');
// Next.js polyfills and global setup usually isn't here, but let's try reading directly via lib/prisma
const prisma = require('./src/lib/prisma').prisma || require('./src/lib/prisma').default;

async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findUnique({
    where: { id: 'cmqe3j1sb000004kvjdbab4gi' },
    include: { contract: true }
  });
  console.log('Lead ID:', lead?.id);
  console.log('Contract clientId:', lead?.contract?.clientId);
  console.log('Contract supplyPointId:', lead?.contract?.supplyPointId);
}

main().catch(console.error).finally(() => process.exit(0));
