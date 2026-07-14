const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  const res = await client.query(`SELECT component, values FROM "SystemComponentPrice" WHERE date = '2026-06-01T00:00:00Z' AND component LIKE 'K%'`);
  for (const row of res.rows) {
    console.log(`Component: ${row.component}`);
    console.log(`Index 19 (19:00): ${row.values[19]}`);
    console.log(`Index 20 (20:00): ${row.values[20]}`);
    console.log(`Index 21 (21:00): ${row.values[21]}`);
    console.log(`Index 22 (22:00): ${row.values[22]}`);
  }
  await client.end();
}
main().catch(console.error);
