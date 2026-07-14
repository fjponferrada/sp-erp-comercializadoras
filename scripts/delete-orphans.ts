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
  const result = await prisma.contract.deleteMany({ 
    where: { brandId: null } 
  }); 
  console.log(`Deleted ${result.count} orphans`); 
}

run().finally(() => prisma.$disconnect());
