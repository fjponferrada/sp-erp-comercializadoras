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
      AND "matricial" = true
      AND "cierre" = 'A2'
    `);

    for (let row of res.rows) {
      const items = row.jsonData;
      if (!items) continue;
      
      console.log("Period 19 Energy by Concept:");
      for (const i of items) {
         if (i.period === 19) {
             console.log(`  ${i.concept.padEnd(5)} | eC: ${i.energyCompras?.toFixed(3)} | eV: ${i.energyVentas?.toFixed(3)} | costO: ${i.costObligaciones?.toFixed(3)} | costD: ${i.costDerechos?.toFixed(3)}`);
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
