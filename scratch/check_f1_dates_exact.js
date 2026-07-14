const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT id, "fechaInicio", "fechaFin"
    FROM "F1Invoice"
    WHERE id = 'cmrahn7u2006u04k2rmcrmcgm'
  `);

  console.log(JSON.stringify(res.rows, null, 2));
  
  await client.end();
}
main().catch(console.error);
