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
  const query = await prisma.$queryRaw`
    SELECT 
      i."invoiceData"->>'Codigo Fiscal' as raw_codigo,
      LTRIM(TRIM(REPLACE(REPLACE(i."invoiceData"->>'Codigo Fiscal', 'CF ', ''), 'CF', '')), '0') as cleaned,
      LTRIM(f1."numeroFactura", '0') as f1_cleaned
    FROM "Invoice" i
    CROSS JOIN "F1Invoice" f1
    WHERE i."invoiceNumber" = 'A260615208' AND f1."numeroFactura" = '3260615030491975'
  `;
  console.log(query);
}

run().catch(console.error).finally(() => prisma.$disconnect());
