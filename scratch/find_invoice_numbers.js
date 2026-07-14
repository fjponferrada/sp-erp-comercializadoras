const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT "numeroFactura"
    FROM "F1Invoice"
  `);

  const found = res.rows.filter(r => r.numeroFactura.includes('1060907') || r.numeroFactura.includes('1060'));
  console.log('Found:', found);

  await client.end();
}

main().catch(console.error);
