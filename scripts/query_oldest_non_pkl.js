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
      SELECT date, source 
      FROM "LoadCurve" 
      WHERE source != 'MIGRACION_PKL' 
      ORDER BY date ASC 
      LIMIT 1
    `);
    console.log("El registro más antiguo sin origen PKL es:");
    console.log(res.rows[0]);
  } catch (err) {
    console.error('Error:', err.stack);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
