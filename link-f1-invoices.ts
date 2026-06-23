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
  console.log('Fetching all invoices that have F1 numbers inside invoiceData...');
  
  // Clean matching for Codigo Fiscal
  const res0 = await prisma.$executeRaw`
    UPDATE "Invoice" i
    SET "f1InvoiceId" = f1.id
    FROM "F1Invoice" f1
    WHERE i."f1InvoiceId" IS NULL AND (
      LTRIM(TRIM(REPLACE(REPLACE(i."invoiceData"->>'Codigo Fiscal', 'CF ', ''), 'CF', '')), '0') = LTRIM(f1."numeroFactura", '0')
    );
  `;
  console.log(`Updated ${res0} invoices using 'Codigo Fiscal' match.`);

  const res1 = await prisma.$executeRaw`
    UPDATE "Invoice" i
    SET "f1InvoiceId" = f1.id
    FROM "F1Invoice" f1
    WHERE LTRIM(i."invoiceData"->>'Numero Factura .xml', '0') = LTRIM(CONCAT(f1."numeroFactura", '.xml'), '0')
      AND i."f1InvoiceId" IS NULL;
  `;
  console.log(`Updated ${res1} invoices using 'Numero Factura .xml' match.`);

  const res2 = await prisma.$executeRaw`
    UPDATE "Invoice" i
    SET "f1InvoiceId" = f1.id
    FROM "F1Invoice" f1
    WHERE LTRIM(i."invoiceData"->>'FechaFtra_NumFtra', '0') LIKE CONCAT('%', LTRIM(f1."numeroFactura", '0'))
      AND i."f1InvoiceId" IS NULL;
  `;
  console.log(`Updated ${res2} invoices using 'FechaFtra_NumFtra' match.`);

  console.log('Done linking invoices to F1 invoices.');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
