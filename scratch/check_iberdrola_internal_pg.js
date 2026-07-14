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
    WHERE "f1InvoiceId" = 'cmreohk93001g04jmc4fg2rod'
  `);

  console.log('Iberdrola Internal:', res.rows.map(r => ({
    f1Volume: r.f1VolumeMWh * 1000,
    cchVolume: r.totalCchMWh * 1000,
    start: r.billingStart,
    end: r.billingEnd
  })));
  await client.end();
}

main().catch(console.error);
