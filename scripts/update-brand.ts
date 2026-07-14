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
  const company = await prisma.company.findFirst();
  if (company) {
    await prisma.company.update({
      where: { id: company.id },
      data: { name: 'AED Energía', codigo: 'AED' }
    });
    console.log("Company updated to AED Energía, codigo: AED");
  }

  const brand = await prisma.brand.findFirst();
  if (brand) {
    await prisma.brand.update({
      where: { id: brand.id },
      data: { name: 'AED Energía', codigoMarca: 'AED', slug: 'aed-energia' }
    });
    console.log("Brand updated to AED Energía, codigoMarca: AED");
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
