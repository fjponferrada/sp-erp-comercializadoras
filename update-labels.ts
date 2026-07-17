import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function run() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const client = new Client({ connectionString });
  await client.connect();
  
  await client.query(`UPDATE "RegulatedDailyCost" SET "label" = 'Financiación del Bono Social (Orden TED/1487/2024)' WHERE "validTo" IS NOT NULL`);
  await client.query(`UPDATE "RegulatedDailyCost" SET "label" = 'Financiación del Bono Social (Orden TED/634/2026)' WHERE "validTo" IS NULL`);
  
  console.log("Labels updated successfully!");
  await client.end();
}

run().catch(console.error);

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
