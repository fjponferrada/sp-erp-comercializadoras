const { Pool } = require('pg');
require('dotenv').config();
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`SELECT sp.cnae FROM "Contract" c JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id WHERE c."contractCode" LIKE '%24451235B0F%'`);
  console.log('SupplyPoint CNAE:', res.rows[0]?.cnae);
  
  const res2 = await pool.query(`SELECT "cnae" FROM "Contract" WHERE "contractCode" LIKE '%24451235B0F%'`);
  console.log('Contract CNAE:', res2.rows[0]?.cnae);
  await pool.end();
}
main();
