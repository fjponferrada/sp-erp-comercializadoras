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
  const company = await prisma.company.findFirst();
  const brand = await prisma.brand.findFirst();
  if (!company || !brand) return;

  const hashedPassword = await bcrypt.hash('123456', 10);

  await prisma.user.upsert({
    where: { email: 'fjponferrada@sp-energia.com' },
    update: { role: 'SUPERADMIN', brandId: brand.id, password: hashedPassword },
    create: {
      name: 'fjponferrada',
      email: 'fjponferrada@sp-energia.com',
      password: hashedPassword,
      role: 'SUPERADMIN',
      brandId: brand.id,
      companies: {
        connect: [{ id: company.id }]
      },
      assignedBrands: {
        connect: [{ id: brand.id }]
      }
    }
  });
  console.log("Superadmin fjponferrada ensured.");
}

run().catch(console.error).finally(() => prisma.$disconnect());
