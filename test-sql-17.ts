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
    const activeCompanyId = 'cm0uou0y500062w81z16a695j'; // typical test company id, wait, maybe I don't need it if I just test the query for that CUPS
    const result = await prisma.$queryRaw`
      SELECT 
        c.id as "contractId",
        c."contractCode",
        c."status",
        c."activationDate",
        c."terminationDate",
        sp."annualConsumption",
        sp."cups",
        i_max."lastBilledDate"
      FROM "Contract" c
      JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
      JOIN "Brand" b ON c."brandId" = b.id
      LEFT JOIN (
        SELECT c2."supplyPointId", MAX(i2."billingEnd") as "lastBilledDate"
        FROM "Invoice" i2
        JOIN "Contract" c2 ON i2."contractId" = c2.id
        GROUP BY c2."supplyPointId"
      ) i_max ON i_max."supplyPointId" = sp.id
      WHERE c.status IN ('ACTIVO', 'FINALIZADO', 'Finalizado', 'Activo')
      AND c."activationDate" IS NOT NULL
      AND sp."cups" = 'ES0294040000003832WJ0F'
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
