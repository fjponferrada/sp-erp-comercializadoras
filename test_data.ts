import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const res = await client.query(`
    SELECT count(*) 
    FROM "Compodem"
    WHERE "date" >= '2026-06-01' AND "date" < '2026-07-01';
  `);

  console.log("Compodem rows for June 2026:", res.rows[0].count);

  const resOmie = await client.query(`
    SELECT count(*) 
    FROM "Omie"
    WHERE "date" >= '2026-06-01' AND "date" < '2026-07-01';
  `);

  console.log("Omie rows for June 2026:", resOmie.rows[0].count);

  await client.end();
}

main().catch(console.error);
