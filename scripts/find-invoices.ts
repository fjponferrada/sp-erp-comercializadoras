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
  await prisma.invoice.deleteMany({ 
    where: { invoiceNumber: 'A260614455' }
  });
  console.log('Deleted A260614455');
}

run().finally(() => prisma.$disconnect());
