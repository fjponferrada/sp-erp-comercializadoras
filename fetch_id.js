const { Pool } = require('pg');
require('dotenv').config();
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`SELECT id FROM "Contract" WHERE "contractCode" LIKE '%24451235B0F%'`);
  console.log(res.rows[0]);
  await pool.end();
}
main();
