require('dotenv').config();
const { Client } = require('pg');

async function test() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    const res = await client.query(`
      SELECT 
        "airtableData"->>'Número Instalación' as numero,
        "airtableData"->>'Piso Instalación' as piso,
        "airtableData"->>'Puerta Instalación' as puerta
      FROM "SupplyPoint"
      WHERE "cups" = 'ES0031105637126001AF0F'
    `);
    
    console.log("Airtable Data:", JSON.stringify(res.rows, null, 2));
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

test();
