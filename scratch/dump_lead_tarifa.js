const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT l."contractData"
    FROM "Contract" c
    LEFT JOIN "Lead" l ON c."leadId" = l.id
    WHERE c."contractCode" = 'PRPR2510301219NM0F'
  `);
  
  const r = res.rows[0];
  console.log("Lead contractData tarifa:", r?.contractData?.tarifa);
  console.log("Lead contractData Tarifa:", r?.contractData?.Tarifa);
  console.log("Lead contractData Código Tarifa:", r?.contractData?.["Código Tarifa"]);
  
  await client.end();
}
main().catch(console.error);
