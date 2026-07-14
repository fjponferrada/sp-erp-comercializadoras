const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const res = await client.query(`
    SELECT "pricingModel", "p1e", "p2e", "p3e", "airtableData"
    FROM "Contract"
    WHERE "supplyPointId" IN (SELECT id FROM "SupplyPoint" WHERE cups = 'ES0031101305190012MF0F')
  `);

  if (res.rows.length > 0) {
    console.log(JSON.stringify(res.rows[0], null, 2));
  } else {
    console.log("No contract found");
  }

  await client.end();
}

main().catch(console.error);
