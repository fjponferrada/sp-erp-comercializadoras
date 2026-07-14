const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT id, "repairData", "totalMWh", "f1InvoiceId"
    FROM "InternalInvoice"
    WHERE "repairData" IS NOT NULL
  `);

  for (const row of res.rows) {
    console.log(JSON.stringify(row, null, 2));
  }
  
  await client.end();
}
main().catch(console.error);
