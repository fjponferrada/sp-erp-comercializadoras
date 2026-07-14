const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

async function main() {
  const url = process.env.DATABASE_URL;
  const pgClient = new Client({ connectionString: url });
  await pgClient.connect();

  const res = await pgClient.query(`
    SELECT "cups", "date", "source", "isProvisional"
    FROM "LoadCurve"
    WHERE "cups" LIKE 'ES0032000002950281LG%'
      AND "date" >= '2025-10-20T00:00:00Z'
      AND "date" <= '2025-10-31T00:00:00Z'
    ORDER BY "date" ASC;
  `);

  if (res.rows.length === 0) {
    console.log("El registro NO EXISTE en la base de datos.");
  } else {
    console.log("El registro SÍ EXISTE en la base de datos. Detalle:");
    console.table(res.rows);
  }

  await pgClient.end();
}

main().catch(console.error);
