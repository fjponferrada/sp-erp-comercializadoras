const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    const res = await client.query(`
      SELECT "date", "jsonData"
      FROM "ReganecuData"
      WHERE "date" >= '2026-06-01 00:00:00' AND "date" < '2026-07-01 00:00:00'
      AND "matricial" = true
      AND "cierre" = 'A2'
    `);

    let cadCount = 0;
    let cadWithCost = 0;
    for (let row of res.rows) {
      const items = row.jsonData;
      if (!items) continue;
      for (const item of items) {
         if (item.concept === 'CAD') {
             cadCount++;
             if (Number(item.cost) > 0 || Number(item.costObligaciones) > 0) {
                 cadWithCost++;
             }
         }
      }
    }

    console.log(`Found ${cadCount} CAD items in MATRICIAL for the month.`);
    console.log(`Found ${cadWithCost} CAD items with cost > 0.`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
