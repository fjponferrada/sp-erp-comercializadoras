const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT sp.cups
    FROM "F1Invoice" f
    JOIN "SupplyPoint" sp ON f."supplyPointId" = sp.id
    WHERE f."numeroFactura" = '171261N071060956'
  `);

  console.log('CUPS:', res.rows[0]?.cups);
  await client.end();
}

main().catch(console.error);
