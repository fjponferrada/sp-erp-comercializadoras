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
  const c = await prisma.contract.findFirst({ where: { contractCode: 'AEDJP231013112G0F' } });
  if (c) {
    console.log("Status en BD:", c.status);
    console.log("Airtable Data 'Estado':", (c.airtableData as any)['Estado']);
  } else {
    console.log("Contrato no encontrado.");
  }
}

main().finally(() => process.exit(0));
