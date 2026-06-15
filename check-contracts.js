require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
async function run() {
  const contracts = await prisma.contract.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, contractCode: true, status: true, signatureDate: true, filePdfSigned: true, docusignEnvelopeId: true }
  });
  console.log(contracts);
  await prisma.$disconnect();
}
run();
