const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query('SELECT COUNT(*) FROM "F1Invoice" WHERE "contractId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "InternalInvoice" WHERE "InternalInvoice"."f1InvoiceId" = "F1Invoice".id)');
  console.log('Pending to bill internally:', res.rows[0].count);
  
  await client.end();
}
main().catch(console.error);
