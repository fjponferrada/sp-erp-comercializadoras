const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT DISTINCT concept
    FROM "RegulatedCost"
  `);

  console.log('Concepts:', res.rows.map(r => r.concept));
  await client.end();
}

main().catch(console.error);
