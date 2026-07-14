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
    console.log('ID:', row.id, 'Created:', row.createdAt);
    console.log('Factura:', row.f1InvoiceId);
    console.log('f1Volume:', row.f1VolumeMWh * 1000, 'kWh');
    console.log('totalCch:', row.totalCchMWh * 1000, 'kWh');
  }

  await client.end();
}

main().catch(console.error);
