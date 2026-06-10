import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const withExpected = await prisma.contract.count({ where: { expectedEndDate: { not: null } } });
  const withoutExpected = await prisma.contract.count({ where: { expectedEndDate: null } });
  
  const sample = await prisma.contract.findFirst({
    where: { status: 'ACTIVO' },
    select: { permanenceStartDate: true, duration: true, expectedEndDate: true, id: true }
  });

  console.log("With expectedEndDate:", withExpected);
  console.log("Without expectedEndDate:", withoutExpected);
  console.log("Sample Active Contract:", sample);
}

main().finally(() => process.exit(0));
