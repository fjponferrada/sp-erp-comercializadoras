const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function query() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  const res = await client.query(`
    SELECT 
      EXTRACT(MONTH FROM datetime) as month,
      AVG("basePriceEurMwh") as avg_base,
      AVG("omiePriceEurMwh") as avg_omie
    FROM "PortfolioBaseCurve"
    WHERE EXTRACT(YEAR FROM datetime) = 2027
    GROUP BY EXTRACT(MONTH FROM datetime)
    ORDER BY month;
  `);
  console.log(res.rows);
  await client.end();
}

query().catch(console.error);
