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
  const f1s = await prisma.f1Invoice.findMany({
    where: { numeroFactura: 'J826003770061' },
    include: { invoices: true }
  });
  console.log("F1s found:", f1s.length);
  for (const f1 of f1s) {
    console.log(`- F1 ID: ${f1.id}, Tipo: ${f1.tipoDocumento}, Saldo: ${f1.saldoFactura}, Linked Invoices: ${f1.invoices.map((i: any) => i.invoiceNumber).join(', ')}`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
