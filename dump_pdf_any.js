const { Pool } = require('pg');
require('dotenv').config();
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`SELECT "invoiceNumber", "pDF", "xML", "pdfUrl", "iDGoogleDrivePDF" FROM "Invoice" WHERE "pDF" IS NOT NULL OR "xML" IS NOT NULL OR "pdfUrl" IS NOT NULL LIMIT 5`);
  console.log(res.rows);
  await pool.end();
}
main();
