const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT c."id", c."version", p.tariff as p_tariff, sp.tariff as sp_tariff
    FROM "Contract" c
    LEFT JOIN "Product" p ON c."productId" = p.id
    LEFT JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
    WHERE c."contractCode" = 'PRPR2510301219NM0F'
  `);
  
  res.rows.forEach(r => {
    console.log(\`Version \${r.version} Product tariff: \${r.p_tariff}\`);
  });
  
  await client.end();
}
main().catch(console.error);
