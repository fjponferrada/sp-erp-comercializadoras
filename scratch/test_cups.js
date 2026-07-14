const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT "supplyPointId" FROM "F1Invoice" WHERE id = 'cmrahn7u2006u04k2rmcrmcgm'
  `);
  
  if (res.rows.length > 0) {
    const sp = await client.query(`
      SELECT cups FROM "SupplyPoint" WHERE id = $1
    `, [res.rows[0].supplyPointId]);
    console.log(sp.rows);
  }

  await client.end();
}

main().catch(console.error);
