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
    const result = await prisma.$queryRaw`
      SELECT 
        c.id as "contractId",
        c."contractCode",
        c."status",
        c."activationDate",
        c."terminationDate",
        sp."annualConsumption",
        sp."cups",
        MAX(MAX(i."billingEnd")) OVER (PARTITION BY sp."cups") as "lastBilledDate"
      FROM "Contract" c
      JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
      JOIN "Brand" b ON c."brandId" = b.id
      LEFT JOIN "Invoice" i ON i."contractId" = c.id
      WHERE c.status NOT IN ('DRAFT', 'Borrador')
      AND c."activationDate" IS NOT NULL
      AND sp."cups" = 'ES0031105245642001VL0F'
      GROUP BY c.id, sp."cups", sp."annualConsumption"
    `;
    console.log(result);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
