const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT f.id, f."numeroFactura", f."fechaInicio", f."fechaFin", f."totalVolume"
    FROM "F1Invoice" f
    JOIN "SupplyPoint" sp ON f."supplyPointId" = sp.id
    WHERE sp.cups LIKE 'ES0031405446869086QD%'
    ORDER BY f."createdAt" DESC
  `);

  console.log('F1s for ERANOVUM:');
  for (const row of res.rows) {
    console.log(row);
  }

  await client.end();
}

main().catch(console.error);
