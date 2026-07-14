import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const brands = await prisma.brand.findMany({
    select: { id: true, name: true, slug: true, codigoMarca: true }
  });
  console.log('Brands in DB:');
  console.log(brands);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
