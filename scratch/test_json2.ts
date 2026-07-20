import { Client } from 'pg';
import { config } from 'dotenv';
config();

async function main() {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  await pgClient.connect();

  const res = await pgClient.query(`
    SELECT "invoiceNumber", "invoiceData"->>'Descuento Bolsillo Solar' as desc1
    FROM "Invoice"
    WHERE ("invoiceData"->>'Descuento Bolsillo Solar') IS NOT NULL
    LIMIT 5
  `);
  console.log("Descuento Bolsillo Solar:");
  console.log(res.rows);

  const res2 = await pgClient.query(`
    SELECT "invoiceNumber", "invoiceData"->>'Descuento aplicado' as desc1
    FROM "Invoice"
    WHERE ("invoiceData"->>'Descuento aplicado') IS NOT NULL
    LIMIT 5
  `);
  console.log("Descuento aplicado:");
  console.log(res2.rows);

  await pgClient.end();
}

main().catch(console.error);
