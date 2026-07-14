import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const companies = await prisma.company.count();
  const brands = await prisma.brand.count();
  const users = await prisma.user.count();
  console.log(`Companies: ${companies}, Brands: ${brands}, Users: ${users}`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
