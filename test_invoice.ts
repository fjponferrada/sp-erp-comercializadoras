import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const res = await client.query(`
    SELECT "invoiceNumber", "totalAmount", c."fee", c."deviationCost"
    FROM "InternalInvoice" i
    JOIN "Contract" c ON i."contractId" = c.id
    JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
    WHERE sp.cups LIKE '%ES0031104899528001TR%'
    ORDER BY i."issueDate" DESC
    LIMIT 1;
  `);

  console.log(res.rows);

  await client.end();
}

main().catch(console.error);
