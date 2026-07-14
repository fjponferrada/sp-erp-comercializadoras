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
  const companies = await prisma.company.findMany();
  const brands = await prisma.brand.findMany();

  await prisma.user.update({
    where: { email: 'fjponferrada@sp-energia.com' },
    data: {
      companies: {
        set: companies.map(c => ({ id: c.id }))
      },
      assignedBrands: {
        set: brands.map(b => ({ id: b.id }))
      }
    }
  });
  console.log(`Assigned ${companies.length} companies and ${brands.length} brands to fjponferrada.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
