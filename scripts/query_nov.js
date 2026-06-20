const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

async function main() {
  const url = process.env.DATABASE_URL;
  console.log("URL:", url.substring(0, 30) + "...");
  
  const client = new Client({
    connectionString: url,
  });

  await client.connect();

  try {
    const res = await client.query(`
      SELECT DISTINCT source 
      FROM "LoadCurve" 
      WHERE date >= '2025-11-01' AND date <= '2025-11-30'
    `);
    console.log("Sources in Nov 2025:");
    console.table(res.rows);
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
