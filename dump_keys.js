const { Pool } = require('pg');
require('dotenv').config();
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`SELECT * FROM "Contract" WHERE "contractCode" LIKE '%24451235B0F%'`);
  console.log(Object.keys(res.rows[0]).filter(k => k.toLowerCase().includes('p2')));
  console.log(res.rows[0]['customP2P']);
  console.log(res.rows[0]['p2PotenciaContratada']);
  await pool.end();
}
main();
