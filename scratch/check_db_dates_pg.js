const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT f.id, f."fechaInicio", f."fechaFin"
    FROM "F1Invoice" f
    JOIN "SupplyPoint" sp ON f."supplyPointId" = sp.id
    WHERE sp.cups LIKE 'ES0031405446869086QD%'
  `);

  for (const row of res.rows) {
    console.log('ID:', row.id);
    console.log('F1 DB FechaInicio:', row.fechaInicio);
    console.log('F1 DB FechaFin:', row.fechaFin);
  }

  await client.end();
}

main().catch(console.error);
