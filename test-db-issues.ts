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
    const duplicates = await prisma.$queryRaw`
      SELECT cups, COUNT(*) as count
      FROM "SupplyPoint"
      GROUP BY cups
      HAVING COUNT(*) > 1
    `;
    console.log(`Duplicate CUPS count: ${Array.isArray(duplicates) ? duplicates.length : 0}`);
    
    // Check for orphaned invoices (not attached to any contract)
    const orphanedInvoices = await prisma.invoice.count({
      where: {
        contractId: null
      }
    });
    console.log(`Orphaned invoices: ${orphanedInvoices}`);

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
