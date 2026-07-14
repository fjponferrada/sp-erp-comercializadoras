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

    for (let row of res.rows) {
      const date = new Date(row.date);
      const day = date.getUTCDate();
      if (day === 23) {
         const items = row.jsonData;
         if (!items) continue;
         
         const cadItems = items.filter(i => i.concept === 'CAD' && (i.period === 18 || i.period === 19));
         for (const c of cadItems) {
            console.log(`Period ${c.period} CAD item:`);
            console.log(c);
         }
      }
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
