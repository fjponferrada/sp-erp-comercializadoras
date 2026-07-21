const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  const res = await client.query(`SELECT "airtableData" FROM "Contract" WHERE "contractCode" = 'PRPR2510301219NM0F'`);
  const data = res.rows[0].airtableData;
  console.log("tarifa:", data["tarifa"]);
  console.log("Tarifa:", data["Tarifa"]);
  console.log("Código Tarifa:", data["Código Tarifa"]);
  console.log("Codigo Tarifa:", data["Codigo Tarifa"]);
  await client.end();
}
main().catch(console.error);
