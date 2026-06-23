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
  const c: any = await prisma.$queryRaw`
    SELECT COUNT(*) FROM "F1Invoice" f1
    INNER JOIN "Invoice" i ON i."invoiceData"->>'Numero Factura .xml' = CONCAT(f1."numeroFactura", '.xml');
  `;
  console.log('Count joined by .xml:', Number(c[0].count));

  const c2: any = await prisma.$queryRaw`
    SELECT COUNT(*) FROM "F1Invoice" f1
    INNER JOIN "Invoice" i ON i."invoiceData"->>'FechaFtra_NumFtra' LIKE CONCAT('%', f1."numeroFactura")
  `;
  console.log('Count joined by FechaFtra:', Number(c2[0].count));
}

run().catch(console.error).finally(() => prisma.$disconnect());
