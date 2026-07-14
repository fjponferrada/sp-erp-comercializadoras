const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT date, readings
    FROM "LoadCurve"
    WHERE cups LIKE 'ES0031405446869086QD%'
      AND date >= '2026-05-31' AND date <= '2026-06-30'
    ORDER BY date ASC
  `);

  for (const row of res.rows) {
    console.log('LC Date:', row.date.toISOString(), 'Readings Length:', row.readings.length);
  }

  await client.end();
}

main().catch(console.error);
