const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    const res = await client.query('SELECT MAX("date") as max_date FROM "LoadCurve"');
    console.log("Max date in LoadCurve:", res.rows[0].max_date);

    const res2 = await client.query('SELECT MAX("date") as max_date FROM "AggregatedLoadCurve"');
    console.log("Max date in AggregatedLoadCurve:", res2.rows[0].max_date);
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

main();
