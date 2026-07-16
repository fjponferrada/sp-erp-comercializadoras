const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT COUNT(*) FROM "Invoice" WHERE "f1InvoiceId" IS NOT NULL');
  console.log('Linked Invoices:', res.rows[0].count);
  const res2 = await client.query('SELECT COUNT(*) FROM "F1Invoice" f WHERE NOT EXISTS (SELECT 1 FROM "Invoice" i WHERE i."f1InvoiceId" = f.id)');
  console.log('Pending F1s:', res2.rows[0].count);
  
  const res3 = await client.query(`
    SELECT "invoiceType", COUNT(*) 
    FROM "Invoice" 
    WHERE "f1InvoiceId" IS NOT NULL 
    GROUP BY "invoiceType"
  `);
  console.log('Linked by type:', res3.rows);

  await client.end();
}
main().catch(console.error);
