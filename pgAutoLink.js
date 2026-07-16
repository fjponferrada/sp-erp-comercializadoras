const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query(`
          UPDATE "Invoice" i
          SET "f1InvoiceId" = f1.id
          FROM "F1Invoice" f1
          WHERE i."f1InvoiceId" IS NULL AND (
            LTRIM(TRIM(REPLACE(REPLACE(i."invoiceData"->>'Codigo Fiscal', 'CF ', ''), 'CF', '')), '0') = LTRIM(f1."numeroFactura", '0')
            OR LTRIM(i."invoiceData"->>'Numero Factura .xml', '0') = LTRIM(CONCAT(f1."numeroFactura", '.xml'), '0')
            OR LTRIM(i."invoiceData"->>'FechaFtra_NumFtra', '0') LIKE CONCAT('%', LTRIM(f1."numeroFactura", '0'))
            OR (
              i."supplyPointId" = f1."supplyPointId"
              AND i."supplyPointId" IS NOT NULL
              AND DATE(i."billingStart") = DATE(f1."fechaInicio")
              AND DATE(i."billingEnd") = DATE(f1."fechaFin")
              AND i."billingStart" IS NOT NULL
              AND i."rectifiedInvoiceId" IS NULL
              AND (
                (i."invoiceType" = 'Abono' AND (
                   f1."numeroFactura" LIKE 'AR-%' 
                   OR f1."jsonData"::text LIKE '%"TipoFactura":"S"%' 
                   OR f1."jsonData"::text LIKE '%"TipoFactura":"A"%'
                   OR f1."jsonData"::text LIKE '%"TipoFactura":"AR"%'
                   OR f1."jsonData"::text LIKE '%"TipoFactura":["S"]%'
                   OR f1."jsonData"::text LIKE '%"TipoFactura":["A"]%'
                   OR f1."jsonData"::text LIKE '%"TipoFactura":["AR"]%'
                )) OR
                ((i."invoiceType" IS NULL OR i."invoiceType" != 'Abono') AND (
                   f1."numeroFactura" NOT LIKE 'AR-%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":"S"%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":"A"%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":"AR"%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":["S"]%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":["A"]%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":["AR"]%'
                ))
              )
            )
          )
        `);
  console.log('Updated rows:', res.rowCount);
  await client.end();
}
main().catch(console.error);
