import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const user = await prisma.user.findUnique({ where: { email: 'fjponferrada@sp-energia.com' } });
  if (!user) {
    console.log("User not found!");
    return;
  }
  const passwordOk = await bcrypt.compare('SpEnergia2026!', user.password);
  console.log("Password is valid? " + passwordOk);
}

run().catch(console.error).finally(() => prisma.$disconnect());
