require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log("Connected to DB!");

  const res = await client.query('SELECT * FROM "Client" WHERE "vatNumber" = $1', ['34001966P']);
  const row = res.rows[0];
  
  if (row) {
    console.log("CLIENT DATA:");
    console.log("contactEmail:", row.contactEmail);
    console.log("contactPhone:", row.contactPhone);
    console.log("firstName:", row.firstName);
    console.log("businessName:", row.businessName);
    console.log("billingStreet:", row.billingStreet);
    
    // airtableData might be parsed or string
    let airtableData = row.airtableData;
    if (typeof airtableData === 'string') {
      try {
        airtableData = JSON.parse(airtableData);
      } catch(e){}
    }
    console.log("Airtable Data keys:", airtableData ? Object.keys(airtableData) : null);
    if (airtableData) {
      console.log("Airtable Nombre:", airtableData['Nombre'] || airtableData['NOMBRE'] || airtableData['nombre']);
      console.log("Airtable Email:", airtableData['Email'] || airtableData['EMAIL']);
      console.log("Airtable DOMICILIO PS:", airtableData['DOMICILIO PS COMPLETO'] || airtableData['DOMICILIO PS']);
      console.log("Airtable TIPO VIA TITULAR:", airtableData['TIPO VIA TITULAR'] || airtableData['TIPO VÍA TITULAR']);
      console.log("Airtable NOMBRE VIA TITULAR:", airtableData['NOMBRE VIA TITULAR'] || airtableData['NOMBRE VÍA TITULAR'] || airtableData['Calle Titular']);
    }
  } else {
    console.log("Client not found");
  }

  await client.end();
}

main().catch(console.error);
