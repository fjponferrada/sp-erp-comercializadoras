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
  const contract = await prisma.contract.findFirst();
  console.log("Contrato dates:");
  console.log("createdAt:", contract?.createdAt);
  console.log("permanenceStartDate:", contract?.permanenceStartDate);
  console.log("activationDate:", contract?.activationDate);
}

run().catch(console.error).finally(() => prisma.$disconnect());
