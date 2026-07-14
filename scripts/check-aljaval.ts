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
  const c = await prisma.contract.findFirst({ where: { contractCode: 'PRPR24424361JS0F' } });
  console.log(JSON.stringify(c?.airtableData, null, 2));
}

run().finally(() => prisma.$disconnect());
