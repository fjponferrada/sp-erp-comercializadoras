const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const { rows } = await pool.query('SELECT * FROM "Lead" LIMIT 1');
  console.log(JSON.stringify(rows[0], null, 2));
}

run().finally(() => pool.end());
