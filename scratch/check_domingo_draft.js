const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const res = await client.query(`
    SELECT * FROM "InternalInvoice"
    WHERE "supplyPointId" IN (SELECT id FROM "SupplyPoint" WHERE cups = 'ES0031101305190012MF0F')
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);

  if (res.rows.length > 0) {
    const draft = res.rows[0];
    console.log("Draft ID:", draft.id);
    console.log("Subtotal1:", draft.subtotal1, "Total:", draft.totalAmount);
    console.log("Calculated details:", JSON.stringify(draft.invoiceData, null, 2));
  } else {
    console.log("No draft found");
  }

  await client.end();
}

main().catch(console.error);
