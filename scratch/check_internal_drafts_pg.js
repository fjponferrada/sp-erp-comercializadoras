const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT *
    FROM "InternalInvoice"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);

  for (const row of res.rows) {
    console.log('Created:', row.createdAt);
    console.log('totalCchMWh:', row.totalCchMWh * 1000, 'kWh');
    console.log('billingStart:', row.billingStart);
    console.log('billingEnd:', row.billingEnd);
  }

  await client.end();
}

main().catch(console.error);
