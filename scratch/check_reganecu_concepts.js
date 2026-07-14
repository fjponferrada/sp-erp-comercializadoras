const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    // Check all ReganecuData for June 2026 to see what concepts we have
    const res = await client.query(`
      SELECT "jsonData"
      FROM "ReganecuData"
      WHERE "date" >= '2026-06-01 00:00:00' AND "date" < '2026-07-01 00:00:00'
      AND "matricial" = false
    `);

    const concepts = new Set();
    for (let row of res.rows) {
      const json = row.jsonData;
      if (json) {
        Object.keys(json).forEach(k => concepts.add(k));
      }
    }
    console.log("Concepts found in Reganecu for June 2026:");
    console.log(Array.from(concepts).sort().join(', '));
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
