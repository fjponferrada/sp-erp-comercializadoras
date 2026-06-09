const { Pool } = require('pg');
require('dotenv').config();
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`SELECT * FROM "Invoice" WHERE "invoiceNumber" = 'A260511025'`);
  const inv = res.rows[0];
  
  if(inv) {
    for (const [key, value] of Object.entries(inv)) {
      if (String(value).includes('500021118860')) console.log('Found in Invoice:', key);
    }
  }

  const res2 = await pool.query(`SELECT * FROM "SupplyPoint" WHERE id = $1`, [inv.supplyPointId]);
  const sp = res2.rows[0];
  if(sp) {
    for (const [key, value] of Object.entries(sp)) {
      if (String(value).includes('500021118860')) console.log('Found in SupplyPoint:', key);
    }
  }
  
  await pool.end();
}
main();
