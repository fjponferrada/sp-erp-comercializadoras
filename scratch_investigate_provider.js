const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
});

async function run() {
  await client.connect();
  const cRes = await client.query(`
    SELECT f1.id, s.cups, (SELECT count(*) FROM "Invoice" i WHERE i."f1InvoiceId" = f1.id) as provider_invoices_count 
    FROM "InternalInvoice" draft
    JOIN "F1Invoice" f1 ON draft."f1InvoiceId" = f1.id
    JOIN "SupplyPoint" s ON draft."supplyPointId" = s.id
    WHERE draft.status IN ('BORRADOR', 'REQUIERE_REPARACION')
    ORDER BY draft."createdAt" DESC
    LIMIT 10
  `);
  console.table(cRes.rows);
  await client.end();
}

run().catch(console.error);
