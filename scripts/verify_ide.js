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

  console.log("Verificando registros de origen FTP para I-DE...");

  const res = await pgClient.query(`
    SELECT "cups", "date", "source"
    FROM "LoadCurve"
    WHERE "source" LIKE 'FTP_I-DE%'
    ORDER BY "date" DESC
    LIMIT 20;
  `);

  if (res.rows.length === 0) {
    console.log("No se encontraron registros de I-DE provenientes de FTP.");
  } else {
    console.table(res.rows.map(row => ({
      cups: row.cups,
      date: new Date(row.date).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      source: row.source
    })));
  }

  // Comprobar si hay fechas en el futuro (error de día por mes)
  const futureRes = await pgClient.query(`
    SELECT "cups", "date", "source"
    FROM "LoadCurve"
    WHERE "source" LIKE 'FTP_I-DE%' AND "date" > NOW()
    LIMIT 5;
  `);

  if (futureRes.rows.length > 0) {
    console.log("¡CUIDADO! Se encontraron fechas en el futuro (posible error día/mes):");
    console.table(futureRes.rows);
  } else {
    console.log("Todo correcto: No hay fechas futuras absurdas.");
  }

  await pgClient.end();
}

main().catch(console.error);
