const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT "fechaInicio", "fechaFin", "totalVolume"
    FROM "F1Invoice"
    WHERE "numeroFactura" = '171261N071060956'
  `);

  console.log('Invoice:', res.rows[0]);
  await client.end();
}

main().catch(console.error);
