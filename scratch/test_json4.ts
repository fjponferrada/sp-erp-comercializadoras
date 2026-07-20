import { Client } from 'pg';
import { config } from 'dotenv';
config();

async function main() {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  await pgClient.connect();

  try {
    const res = await pgClient.query(`
      SELECT id, "invoiceData"->>'Descuento Bolsillo Solar' as val FROM "Invoice"
      WHERE ("invoiceData"->>'Descuento Bolsillo Solar') IS NOT NULL
        AND TRIM("invoiceData"->>'Descuento Bolsillo Solar') != ''
        AND REPLACE("invoiceData"->>'Descuento Bolsillo Solar', ',', '.')::numeric != 0
    `);
    console.log(`Success: ${res.rowCount} rows`);
    console.log(res.rows.slice(0, 5));
  } catch (e: any) {
    console.error("Query Error:", e.message);
  }

  await pgClient.end();
}

main().catch(console.error);
