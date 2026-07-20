require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const spRes = await client.query('SELECT * FROM "SupplyPoint" WHERE "cups" = $1', ['ES0031101349554004WN0F']);
  for (const sp of spRes.rows) {
    let airData = sp.airtableData;
    if (typeof airData === 'string') {
      try { airData = JSON.parse(airData); } catch(e){}
    }
    if (airData) {
      console.log("--- ALL AIRTABLE DATA KEYS AND VALUES ---");
      for (const [key, val] of Object.entries(airData)) {
        if (key.toLowerCase().includes('tel') || key.toLowerCase().includes('phone') || key.toLowerCase().includes('movil') || key.toLowerCase().includes('móvil') || key.toLowerCase().includes('mail') || key.toLowerCase().includes('via') || key.toLowerCase().includes('calle') || key.toLowerCase().includes('domicilio')) {
          console.log(`KEY: [${key}] =`, val);
        }
      }
      
      // Let's also just dump any key that contains the phone number '615602996' just to be absolutely sure.
      for (const [key, val] of Object.entries(airData)) {
        if (String(val).includes('615602996')) {
          console.log(`\nFound phone number in key: [${key}] =`, val);
        }
      }
    }
  }

  await client.end();
}

main().catch(console.error);
