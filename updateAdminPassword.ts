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
  const hashedPassword = await bcrypt.hash('SpEnergia2026!', 10);

  const user = await prisma.user.update({
    where: { email: 'fjponferrada@sp-energia.com' },
    data: { password: hashedPassword, role: 'SUPERADMIN' }
  });
  console.log("Password updated successfully for: " + user.email);
}

run().catch(console.error).finally(() => prisma.$disconnect());
