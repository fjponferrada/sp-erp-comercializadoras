const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL
  });

  const res = await pool.query(`
    SELECT COUNT(*) as c FROM "Contract"
    WHERE "tipo" = 'R' AND "status" = 'ACEPTADO' AND "previousContractId" IS NULL
  `);
  
  console.log("Aceptados with NULL previous:", res.rows[0].c);

  await pool.end();
}

main().catch(console.error);
