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
  const f1 = await prisma.f1Invoice.findFirst({
    where: { numeroFactura: '171261Y000555507' },
    include: { invoices: { select: { invoiceNumber: true } } }
  });
  console.log("F1 171261Y000555507 Invoices:", f1?.invoices);

  const inv = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'A260614398' },
    select: { f1InvoiceId: true, f1Invoice: { select: { numeroFactura: true } } }
  });
  console.log("Invoice A260614398 F1 Link:", inv);
}

run().catch(console.error).finally(() => prisma.$disconnect());
