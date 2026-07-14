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
      WHERE "date" >= '2026-06-23 00:00:00' AND "date" < '2026-06-24 00:00:00'
      AND "matricial" = true
      AND "cierre" = 'A2'
    `);

    console.log(`Found ${res.rows.length} rows for June 23 A2 Matricial`);
    
    for (let i = 0; i < res.rows.length; i++) {
      const items = res.rows[i].jsonData;
      if (!items) continue;
      
      const cad19 = items.filter(x => x.concept === 'CAD' && x.period === 19);
      if (cad19.length > 0) {
          console.log(`Row ${i} CAD 19:`, cad19);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
