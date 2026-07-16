const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("SELECT id FROM \"F1Invoice\" WHERE \"numeroFactura\" = '171261N066169079'");
  console.log('Found:', res.rows.length);
  await client.end();
}
main().catch(console.error);
