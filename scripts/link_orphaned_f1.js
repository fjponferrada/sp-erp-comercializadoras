const { Client } = require('pg');

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });
  
  await client.connect();

  console.log(`Starting F1 Orphan Linker Script [DRY_RUN: ${isDryRun}]`);

  // Fetch all F1s that have NO linked invoices
  const orphanF1Query = `
    SELECT f.id, f."numeroFactura", f."supplyPointId", f."fechaInicio", f."fechaFin"
    FROM "F1Invoice" f
    LEFT JOIN "Invoice" i ON i."f1InvoiceId" = f.id
    WHERE i.id IS NULL AND f."supplyPointId" IS NOT NULL
  `;
  
  const { rows: orphanF1s } = await client.query(orphanF1Query);
  console.log(`Found ${orphanF1s.length} orphaned F1 invoices.`);

  let matchedAirtableCount = 0;
  let matchedNativeCount = 0;

  for (const f1 of orphanF1s) {
    if (!f1.numeroFactura || !f1.supplyPointId) continue;
    const codFactura = f1.numeroFactura.replace(/^0+/, ''); // LTRIM '0'

    // First try Airtable logic
    const airtableMatchQuery = `
      SELECT id, "invoiceNumber" FROM "Invoice"
      WHERE "f1InvoiceId" IS NULL AND "supplyPointId" = $1 AND (
        LTRIM(TRIM(REPLACE(REPLACE("invoiceData"->>'Codigo Fiscal', 'CF ', ''), 'CF', '')), '0') = $2
        OR LTRIM("invoiceData"->>'Numero Factura .xml', '0') = CONCAT($2, '.xml')
        OR LTRIM("invoiceData"->>'FechaFtra_NumFtra', '0') LIKE CONCAT('%', $2)
      )
      LIMIT 1
    `;
    const airtableRes = await client.query(airtableMatchQuery, [f1.supplyPointId, codFactura]);
    let matchedInvoice = airtableRes.rows[0];
    let matchType = '';

    if (matchedInvoice) {
      matchType = 'AIRTABLE';
      matchedAirtableCount++;
    } else {
      // Try Native logic: exact dates match
      if (f1.fechaInicio && f1.fechaFin) {
        const nativeMatchQuery = `
          SELECT id, "invoiceNumber" FROM "Invoice"
          WHERE "f1InvoiceId" IS NULL AND "supplyPointId" = $1
            AND DATE("billingStart") = DATE($2)
            AND DATE("billingEnd") = DATE($3)
            AND "rectifiedInvoiceId" IS NULL
          LIMIT 1
        `;
        const nativeRes = await client.query(nativeMatchQuery, [f1.supplyPointId, f1.fechaInicio, f1.fechaFin]);
        matchedInvoice = nativeRes.rows[0];
        if (matchedInvoice) {
          matchType = 'NATIVE';
          matchedNativeCount++;
        }
      }
    }

    if (matchedInvoice) {
      if (f1.numeroFactura === '171262N000858075') {
        console.log(`>>> TARGET F1 171262N000858075 DETECTED -> Links to Invoice ${matchedInvoice.invoiceNumber} via ${matchType} logic`);
      }
      
      if (!isDryRun) {
        await client.query(`UPDATE "Invoice" SET "f1InvoiceId" = $1 WHERE id = $2`, [f1.id, matchedInvoice.id]);
      }
    }
  }

  console.log(`\nResults:`);
  console.log(`- Airtable matches: ${matchedAirtableCount}`);
  console.log(`- Native matches: ${matchedNativeCount}`);
  console.log(`- Total potential links: ${matchedAirtableCount + matchedNativeCount}`);

  if (isDryRun && (matchedAirtableCount + matchedNativeCount > 0)) {
      console.log(`\nNOTE: This was a DRY RUN. No database updates were made. Run without --dry-run to apply.`);
  }

  await client.end();
}

main().catch(console.error);
