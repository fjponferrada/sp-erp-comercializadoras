require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

async function main() {
  const supplyPointRes = await pool.query('SELECT * FROM "SupplyPoint" WHERE "cups" LIKE \'%ES0307000014568075GW%\'');
  console.log("SupplyPoints:", supplyPointRes.rows);

  const leadRes = await pool.query('SELECT "id", "cups", "contractId" FROM "Lead" WHERE "cups" LIKE \'%ES0307000014568075GW%\'');
  console.log("Leads:", leadRes.rows);
}

main().catch(console.error).finally(() => pool.end());
