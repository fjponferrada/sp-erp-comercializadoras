const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT c."airtableData", p.tariff as p_tariff, sp.tariff as sp_tariff, c."contractCode"
    FROM "Contract" c
    LEFT JOIN "Product" p ON c."productId" = p.id
    LEFT JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
    WHERE c."contractCode" = 'PRPR2510301219NM0F'
  `);
  
  const r = res.rows[0];
  console.log("contractCode:", r.contractCode);
  console.log("airtableData tarifa:", r.airtableData?.tarifa);
  console.log("airtableData Tarifa:", r.airtableData?.Tarifa);
  console.log("airtableData Código Tarifa:", r.airtableData?.["Código Tarifa"]);
  console.log("Product tariff:", r.p_tariff);
  console.log("SupplyPoint tariff:", r.sp_tariff);
  
  await client.end();
}
main().catch(console.error);
