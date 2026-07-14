const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function query() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  const res = await client.query("SELECT * FROM \"FuturePrice\" ORDER BY month ASC;");
  console.log(res.rows);
  await client.end();
}

query().catch(console.error);
