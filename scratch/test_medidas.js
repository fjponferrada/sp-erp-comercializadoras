const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const res = await client.query(`
    SELECT "jsonData" FROM "F1Invoice"
    WHERE "supplyPointId" = (SELECT id FROM "SupplyPoint" WHERE cups LIKE 'ES0031101499771003%' LIMIT 1)
    ORDER BY "fechaEmision" DESC LIMIT 1
  `);
  
  if (res.rows.length > 0) {
    const jsonData = res.rows[0].jsonData;
    const medidas = jsonData.Medidas || jsonData.Facturas?.FacturaATR?.Medidas || jsonData.Facturas?.FacturaATR?.[0]?.Medidas;
    console.log(JSON.stringify(medidas, null, 2));
  } else {
    console.log("No invoice found");
  }
  await client.end();
}

main().catch(console.error);
