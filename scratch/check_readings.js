const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  const res = await client.query(`
    SELECT readings 
    FROM "LoadCurve" 
    WHERE id = 'cmr40q7td010dm441ke68rt73'
  `);
  if(res.rows.length > 0) {
      console.log(res.rows[0].readings);
  }
  await client.end();
}
main().catch(console.error);
