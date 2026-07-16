const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL });
  await client.connect();

  // Find all F1s created in the last 24 hours that are not Normal (just in case they start with 171261S)
  const f1sRes = await client.query(`
    SELECT id, "numeroFactura", "supplyPointId", "fechaInicio", "fechaFin"
    FROM "F1Invoice"
    WHERE "numeroFactura" LIKE '171261S%' OR "numeroFactura" LIKE 'AR-%'
  `);
  
  console.log('Found ' + f1sRes.rows.length + ' potential S/AR F1s.');

  let updated = 0;
  for (const f1 of f1sRes.rows) {
    if (!f1.supplyPointId) continue;

    // Find the corresponding Abono invoice
    const matchingInvoiceRes = await client.query(`
      SELECT id, "invoiceNumber"
      FROM "Invoice"
      WHERE "supplyPointId" = $1
        AND "invoiceType" = 'Abono'
        AND "f1InvoiceId" IS NULL
      LIMIT 1
    `, [f1.supplyPointId]);

    const matchingInvoice = matchingInvoiceRes.rows[0];

    if (matchingInvoice) {
      await client.query(`
        UPDATE "Invoice"
        SET "f1InvoiceId" = $1
        WHERE id = $2
      `, [f1.id, matchingInvoice.id]);
      updated++;
      console.log('Linked F1 ' + f1.numeroFactura + ' to Invoice ' + matchingInvoice.invoiceNumber);
    }
  }
  
  console.log('Updated ' + updated + ' invoices.');
  await client.end();
}
main().catch(console.error);
