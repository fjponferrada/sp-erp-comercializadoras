const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT "totalVolume"
    FROM "F1Invoice"
    WHERE "numeroFactura" = '171261N081118993'
  `);

  console.log('Iberdrola F1 TotalVolume:', res.rows[0]?.totalVolume);
  await client.end();
}

main().catch(console.error);
