const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  
  // Transform all 1-12 into 202601-202612
  const currentYear = 2026;
  const res = await client.query('SELECT * FROM "FuturePrice"');
  for (const row of res.rows) {
    if (row.month >= 1 && row.month <= 12) {
      const newMonth = currentYear * 100 + row.month;
      await client.query('UPDATE "FuturePrice" SET month = $1 WHERE id = $2', [newMonth, row.id]);
      console.log(`Migrated ${row.month} to ${newMonth}`);
    }
  }
  
  console.log("Migration complete.");
  await client.end();
}

migrate().catch(console.error);
