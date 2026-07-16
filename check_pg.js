const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT "cups", "paso", "procesoBase", "fechaSolicitud", "fechaAR", "estadoAR"
    FROM "SwitchingEvent"
    WHERE "cups" = 'ES0031408606998002PH' OR "cups" = 'ES0031408738923001TF'
    ORDER BY "fechaSolicitud" ASC
  `);
  console.log(res.rows);
  await client.end();
}

main().catch(console.error);
