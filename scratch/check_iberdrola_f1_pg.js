const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT "totalMWh"
    FROM "Invoice"
    WHERE "f1InvoiceId" = 'cmreohk93001g04jmc4fg2rod'
  `);

  console.log('Iberdrola F1 Total:', res.rows[0]?.totalMWh * 1000);
  await client.end();
}

main().catch(console.error);
