const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT * FROM "Invoice" WHERE "invoiceNumber" LIKE '%1060907%'
  `);
  
  if (res.rows.length === 0) {
     const res2 = await client.query(`
        SELECT * FROM "InternalInvoice" WHERE "invoiceData"->>'Factura' LIKE '%1060907%' OR "invoiceData"->>'Codigo Fiscal' LIKE '%1060907%'
     `);
     console.log('InternalInvoices:', res2.rows);
  } else {
     console.log('Invoices:', res.rows);
  }

  await client.end();
}

main().catch(console.error);
