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
  const activeCompanyId = 'dummy-company-id'; // just to test syntax
  try {
    const contractsRaw = await prisma.$queryRaw`
      SELECT 
        c.id as "contractId",
        c."contractCode",
        c."status",
        c."activationDate",
        c."terminationDate",
        c."annualConsumption",
        sp."cups",
        MAX(i."billingEnd") as "lastBilledDate"
      FROM "Contract" c
      JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
      JOIN "Brand" b ON c."brandId" = b.id
      LEFT JOIN "Invoice" i ON i."contractId" = c.id
      WHERE c.status NOT IN ('DRAFT', 'Borrador')
      AND c."activationDate" IS NOT NULL
      AND b."companyId" = 'foo'
      GROUP BY c.id, sp."cups"
      LIMIT 10
    `;
    console.log("SQL executed successfully.");
  } catch (error) {
    console.error("SQL Error:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
