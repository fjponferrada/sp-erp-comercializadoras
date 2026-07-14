const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT "invoiceNumber"
    FROM "Invoice"
    WHERE "f1InvoiceId" = 'cmrahn7u2006u04k2rmcrmcgm'
  `);

  console.log('Invoice Number ERANOVUM:', res.rows[0]?.invoiceNumber);
  await client.end();
}

main().catch(console.error);
