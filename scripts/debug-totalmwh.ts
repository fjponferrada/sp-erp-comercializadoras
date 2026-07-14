import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const inv = await prisma.invoice.findFirst({ where: { invoiceNumber: 'A260614452' } });
  console.log('A260614452:', inv?.totalMWh);
  const inv2 = await prisma.invoice.findFirst({ where: { invoiceNumber: 'A260614455' } });
  console.log('A260614455:', inv2?.totalMWh);
}
run();
