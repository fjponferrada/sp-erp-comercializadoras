import { Client } from 'pg';
import { config } from 'dotenv';
config();

async function main() {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  await pgClient.connect();

  const res = await pgClient.query(`
    SELECT "invoiceNumber", "invoiceData"->>'Descuento Bolsillo Solar' as desc1, "invoiceData"->>'Descuento' as desc2, "invoiceData"->>'BOLSILLO SOLAR' as desc3
    FROM "Invoice"
    WHERE "invoiceData"::text ILIKE '%bolsillo%' OR "invoiceData"::text ILIKE '%Descuento%'
    LIMIT 5
  `);
  console.log(res.rows);

  await pgClient.end();
}

main().catch(console.error);
