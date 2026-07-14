const { Pool } = require('pg');
require('dotenv').config();
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`SELECT "invoiceNumber", "filePdfSigned", "filePdfDraft", "outputPdf", "pdfCoOutput" FROM "Invoice" WHERE "filePdfSigned" IS NOT NULL OR "filePdfDraft" IS NOT NULL OR "outputPdf" IS NOT NULL OR "pdfCoOutput" IS NOT NULL LIMIT 5`);
  console.log(res.rows);
  await pool.end();
}
main();
