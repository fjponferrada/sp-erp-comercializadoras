const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT date, COUNT(*)
    FROM "LoadCurve"
    WHERE cups LIKE 'ES0031405446869086QD%'
      AND date >= '2026-05-30' AND date <= '2026-07-02'
    GROUP BY date
    HAVING COUNT(*) > 1
  `);

  console.log('Duplicates:', res.rows);

  await client.end();
}

main().catch(console.error);
