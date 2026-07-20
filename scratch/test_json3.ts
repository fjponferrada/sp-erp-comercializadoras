import { Client } from 'pg';
import { config } from 'dotenv';
config();

async function main() {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  await pgClient.connect();

  const res = await pgClient.query(`
    SELECT "invoiceNumber", "invoiceData"->'Descuento Bolsillo Solar' as desc1, pg_typeof("invoiceData"->'Descuento Bolsillo Solar') as type1
    FROM "Invoice"
    WHERE ("invoiceData"->>'Descuento Bolsillo Solar') IS NOT NULL
    LIMIT 5
  `);
  console.log(res.rows);

  await pgClient.end();
}

main().catch(console.error);
