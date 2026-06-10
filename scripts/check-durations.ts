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
  const withDuration = await prisma.contract.count({ where: { duration: { not: null } } });
  
  const sample = await prisma.contract.findFirst({
    where: { status: 'ACTIVO', product: { permanenceMonths: { not: null } } },
    select: { permanenceStartDate: true, duration: true, product: { select: { name: true, permanenceMonths: true } } }
  });

  console.log("Contracts with duration populated:", withDuration);
  console.log("Sample Active Contract with Product permanence:", sample);
}

main().finally(() => process.exit(0));
