const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT c."contractCode", c."airtableData", sp.cups, sp.tariff as "spTariff", p.tariff as "pTariff"
    FROM "Contract" c
    LEFT JOIN "Client" cl ON c."clientId" = cl.id
    LEFT JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
    LEFT JOIN "Product" p ON c."productId" = p.id
    WHERE cl."firstName" ILIKE '%PALENCIANA%' 
       OR cl."lastName" ILIKE '%PALENCIANA%'
       OR cl."companyName" ILIKE '%PALENCIANA%'
  `);
  console.log(`Found ${res.rows.length} contracts for PALENCIANA:`);
  res.rows.forEach(r => {
    console.log("contractCode:", r.contractCode, "CUPS:", r.cups);
    console.log("Tarifa:", r.airtableData?.Tarifa);
    console.log("tarifa:", r.airtableData?.tarifa);
    console.log("Código Tarifa:", r.airtableData?.["Código Tarifa"]);
    console.log("SP Tariff:", r.spTariff);
    console.log("P Tariff:", r.pTariff);
    console.log("-----");
  });
  
  await client.end();
}
main().catch(console.error);
