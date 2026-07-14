const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

async function main() {
  const url = process.env.DATABASE_URL;
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT MIN(date) as min_date, MAX(date) as max_date 
      FROM "LoadCurve" 
      WHERE source LIKE 'FTP_%'
    `);
    console.log(res.rows[0]);
  } catch (err) {
    console.error('Error:', err.stack);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
