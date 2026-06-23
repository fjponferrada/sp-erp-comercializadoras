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
    const contractsRaw: any[] = await prisma.$queryRaw`
      SELECT 
        c."annualConsumption" as "contractConsump",
        sp."annualConsumption" as "spConsump",
        sp."cups"
      FROM "Contract" c
      JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
      WHERE c.status NOT IN ('DRAFT', 'Borrador')
      AND c."activationDate" IS NOT NULL
      LIMIT 10
    `;
    console.log(contractsRaw);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
