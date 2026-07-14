const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  const res = await client.query(`
    SELECT id, date 
    FROM "LoadCurve" 
    WHERE cups = 'ES0031405446869086QD' 
    AND date >= '2026-05-31T00:00:00Z' 
    AND date <= '2026-06-03T00:00:00Z' 
    ORDER BY date ASC
  `);
  for (const row of res.rows) {
    console.log(`ID: ${row.id}, Date: ${row.date.toISOString()}`);
  }
  await client.end();
}
main().catch(console.error);
