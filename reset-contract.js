require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function resetContract() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  await prisma.contract.update({
    where: { docusignEnvelopeId: 'a1e0fb16-f2b7-8272-81dc-f67239c88638' },
    data: {
      status: 'BORRADOR',
      filePdfSigned: null
    }
  });

  console.log('Contract reset to BORRADOR');
  await prisma.$disconnect();
}

resetContract().catch(console.error);
