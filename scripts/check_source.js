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
      SELECT source, COUNT(*) as total 
      FROM "LoadCurve" 
      GROUP BY source
    `);
    console.log("Desglose actual de orígenes en LoadCurve:");
    console.table(res.rows);
  } catch (err) {
    console.error('Error:', err.stack);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
