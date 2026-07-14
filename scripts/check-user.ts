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
  const user = await prisma.user.findUnique({
    where: { email: 'fjponferrada@sp-energia.com' },
    include: { companies: true, assignedBrands: true, brand: true }
  });
  console.log(JSON.stringify(user, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
