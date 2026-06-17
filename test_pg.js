const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });

  await client.connect();

  const res = await client.query(`
    SELECT "invoiceNumber", "invoiceData" 
    FROM "Invoice" i
    JOIN "SupplyPoint" s ON i."supplyPointId" = s.id
    WHERE i."issueDate" >= '2026-01-01T00:00:00Z'
      AND i."issueDate" <= '2026-03-31T23:59:59Z'
      AND s.province ILIKE '%guip%'
  `);

  console.log(`Found ${res.rowCount} invoices for Guipuzcoa`);
  
  res.rows.forEach(row => {
    const data = typeof row.invoiceData === 'string' ? JSON.parse(row.invoiceData) : row.invoiceData;
    console.log(`\nInvoice ${row.invoiceNumber}:`);
    console.log(`  Subtotal 1: ${data['Subtotal 1']}`);
    console.log(`  BI Subtotal 1: ${data['BI Subtotal 1']}`);
    console.log(`  BaseImponibleF1: ${data['BaseImponibleF1']}`);
    console.log(`  Importe Impuesto: ${data['Importe Impuesto']}`);
    console.log(`  Tipo Factura: ${data['Tipo Factura']}`);
  });

  await client.end();
}

main().catch(console.error);
