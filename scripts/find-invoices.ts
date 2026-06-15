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
    where: { invoiceNumber: { in: ['A260614455', 'A260614780', 'R260600114'] } },
    include: { contract: true }
  });
  console.log(JSON.stringify(invs, null, 2));
}

run().finally(() => prisma.$disconnect());
