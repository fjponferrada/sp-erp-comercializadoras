import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const invs = await prisma.invoice.findMany({ 
    where: { issueDate: { lt: new Date('2000-01-01') } }
  });
  console.log(`Found ${invs.length} invoices from 1970`);
  for (const inv of invs) {
    await prisma.invoice.delete({ where: { id: inv.id } });
  }
  console.log('Deleted them so they can be reimported');
}

run().finally(() => prisma.$disconnect());
