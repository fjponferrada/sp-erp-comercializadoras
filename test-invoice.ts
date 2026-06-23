import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: 'A260614169'
      },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        billingStart: true,
        billingEnd: true,
        contractId: true
      }
    });
    console.log(invoice);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
