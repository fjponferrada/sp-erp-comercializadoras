const { Pool } = require('pg');
require('dotenv').config();
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`SELECT id FROM "Contract" WHERE "contractCode" LIKE '%24451235B0F%'`);
  const c = res.rows[0];
  const invs = await pool.query(`SELECT * FROM "Invoice" WHERE "contractId" = $1`, [c.id]);
  console.log(invs.rows.map(i => ({ desde: i.desde, hasta: i.hasta, desdeEA: i.desdeEA, hastaEA: i.hastaEA })));
  await pool.end();
}
main();
