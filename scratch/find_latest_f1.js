const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT *
    FROM "F1Invoice"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);

  for (const row of res.rows) {
    console.log('ID:', row.id, 'Created:', row.createdAt);
    console.log('Factura:', row.numeroFactura);
    console.log('fechaInicio:', row.fechaInicio);
    console.log('fechaFin:', row.fechaFin);
    console.log('totalVolume:', row.totalVolume);
  }

  await client.end();
}

main().catch(console.error);
