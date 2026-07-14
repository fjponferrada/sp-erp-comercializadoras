const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const res = await pool.query(`SELECT concept, p1, p2, p3, p4, p5, p6, "singleValue" FROM "RegulatedCost" WHERE tariff = '2.0TD' OR tariff = 'TODAS'`);
  console.log(res.rows);
}

main().catch(console.error).finally(() => pool.end());
