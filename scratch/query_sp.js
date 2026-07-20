require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const res = await client.query('SELECT id FROM "Client" WHERE "vatNumber" = $1', ['34001966P']);
  const clientId = res.rows[0]?.id;
  
  if (clientId) {
    const spRes = await client.query('SELECT * FROM "SupplyPoint" WHERE "clientId" = $1', [clientId]);
    console.log("Found SupplyPoints:", spRes.rows.length);
    for (const sp of spRes.rows) {
      console.log("SP CUPS:", sp.cups);
      let airData = sp.airtableData;
      if (typeof airData === 'string') {
        try { airData = JSON.parse(airData); } catch(e){}
      }
      if (airData) {
        console.log("Airtable Email:", airData['Email'] || airData['EMAIL']);
        console.log("Airtable TIPO VIA:", airData['TIPO VIA TITULAR'] || airData['TIPO VÍA TITULAR']);
        console.log("Airtable NOMBRE VIA:", airData['NOMBRE VIA TITULAR'] || airData['Calle Titular'] || airData['NOMBRE VIA']);
        console.log("Airtable Telefono:", airData['Teléfono'] || airData['TELEFONO']);
      }
    }
  }

  await client.end();
}

main().catch(console.error);
