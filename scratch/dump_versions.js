const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT "id", "contractCode", "version", "createdAt", "airtableData"
    FROM "Contract"
    WHERE "contractCode" = 'PRPR2510301219NM0F'
    ORDER BY "version" ASC
  `);
  
  console.log(`Found ${res.rows.length} rows for this contract code.`);
  res.rows.forEach(r => {
    console.log("[Version " + r.version + "] ID " + r.id + " | Created: " + r.createdAt);
    console.log("  Tarifa:", r.airtableData?.Tarifa);
    console.log("  tarifa:", r.airtableData?.tarifa);
    console.log("  Código Tarifa:", r.airtableData?.["Código Tarifa"]);
  });
  
  await client.end();
}
main().catch(console.error);
