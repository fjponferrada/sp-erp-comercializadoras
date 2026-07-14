const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT *
    FROM "RegulatedCost"
    WHERE concept IN ('Pago_OM', 'Pago_OS')
  `);

  console.log('RegulatedCost Pago_OM/OS:', res.rows);
  await client.end();
}

main().catch(console.error);
