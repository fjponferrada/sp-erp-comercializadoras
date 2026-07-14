const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  // Update fechaInicio by subtracting 1 day for all F1Invoices ingested recently (e.g. today or having 22:00:00 UTC)
  // Wait, if we subtract 1 day from 2026-06-01T22:00:00.000Z, it becomes 2026-05-31T22:00:00.000Z
  const res = await client.query(`
    UPDATE "F1Invoice"
    SET "fechaInicio" = "fechaInicio" - INTERVAL '1 day'
    WHERE EXTRACT(HOUR FROM "fechaInicio") = 22
  `);
  console.log('Updated F1Invoices:', res.rowCount);
  await client.end();
}
main().catch(console.error);
