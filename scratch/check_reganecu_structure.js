const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    const res = await client.query(`
      SELECT "jsonData"
      FROM "ReganecuData"
      WHERE "date" >= '2026-06-23 00:00:00' AND "date" < '2026-06-24 00:00:00'
      AND "matricial" = false
      LIMIT 1
    `);

    if (res.rows.length > 0) {
      const data = res.rows[0];
      const json = data.jsonData;
      console.log("Keys of jsonData:", Object.keys(json));
      if (Array.isArray(json)) {
        console.log("First element:", json[0]);
      } else {
        const firstKey = Object.keys(json)[0];
        console.log("First element:", json[firstKey]);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
