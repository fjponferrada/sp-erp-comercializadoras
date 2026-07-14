const { Pool } = require('pg');
require('dotenv').config();
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`SELECT "invoiceData" FROM "Invoice" WHERE "invoiceNumber" = 'A260511025'`);
  const inv = res.rows[0];
  
  if(inv && inv.invoiceData) {
    console.log('PDF:', inv.invoiceData['PDF']);
    console.log('XML:', inv.invoiceData['XML']);
  } else {
    console.log('No invoiceData found');
  }

  await pool.end();
}
main();
