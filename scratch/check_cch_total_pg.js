const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const cups = 'ES0031405446869086QD';
  
  const res = await client.query(`
    SELECT "date", "readings"
    FROM "LoadCurve"
    WHERE "cups" = $1
      AND "date" >= '2026-05-31T22:00:00.000Z'
      AND "date" < '2026-06-30T22:00:00.000Z'
    ORDER BY "date" ASC
  `, [cups]);

  let totalMWh = 0;
  for (const row of res.rows) {
    let dayMWh = 0;
    for (const val of row.readings) {
      dayMWh += (val || 0) / 1000.0;
    }
    console.log(`Date: ${new Date(row.date).toISOString()}, MWh: ${dayMWh}`);
    totalMWh += dayMWh;
  }
  
  console.log(`Total MWh: ${totalMWh}`);
  await client.end();
}
main().catch(console.error);
