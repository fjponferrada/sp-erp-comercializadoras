const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT id, "jsonData"
    FROM "F1Invoice"
    LIMIT 1
  `);

  console.log(JSON.stringify(res.rows[0], null, 2));
  await client.end();
}

main().catch(console.error);
