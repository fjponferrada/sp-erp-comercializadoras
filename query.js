require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const inv = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'A260511138' }
  });
  console.log('pdfUrl:', inv.pdfUrl);
  console.log('xmlUrl:', inv.invoiceData?.xmlUrl || inv.invoiceData?.xML);
}

run().finally(() => prisma.$disconnect());
