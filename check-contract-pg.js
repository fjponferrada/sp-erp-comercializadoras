const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL
  });

  const res = await pool.query(`
    SELECT id, status, tipo, "previousContractId", "expectedEndDate" FROM "Contract"
    WHERE "contractCode" = 'PRPR26424941RG0F'
  `);
  
  if (res.rows.length === 0) {
    console.log("No contract found");
  } else {
    const c1 = res.rows[0];
    console.log("C1:", c1);
    if (c1.previousContractId) {
      const prev = await pool.query(`
        SELECT id, "contractCode", "expectedEndDate" FROM "Contract"
        WHERE id = $1
      `, [c1.previousContractId]);
      console.log("PREV:", prev.rows[0]);
    }
  }

  await pool.end();
}

main().catch(console.error);
