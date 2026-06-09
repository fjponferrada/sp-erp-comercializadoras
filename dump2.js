const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`SELECT * FROM "Contract" WHERE "contractCode" LIKE '%24451235B0F%'`);
  const c = res.rows[0];
  if (!c) { console.log('not found'); return; }
  
  const res2 = await pool.query(`SELECT * FROM "Lead" WHERE "contractId" = $1`, [c.id]);
  const lead = res2.rows[0] || {};
  
  const res3 = await pool.query(`SELECT * FROM "SupplyPoint" WHERE "id" = $1`, [c.supplyPointId]);
  const sp = res3.rows[0] || {};
  
  console.log('Contract p1e:', c.p1e, 'p1Efrom:', c.p1EfromPRODUCTOS, 'p1p:', c.p1PfromPRODUCTOS);
  console.log('Lead p1e:', lead.p1e, 'p1Efrom:', lead.p1EfromPRODUCTOS, 'p1p:', lead.p1PfromPRODUCTOS);
  console.log('SP p1p:', sp.p1p, 'p1c:', sp.p1c);
  
  await pool.end();
}
main().catch(console.error);
