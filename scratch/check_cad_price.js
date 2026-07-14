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
      // Format to local date string to find June 23
      const day = date.getUTCDate();
      if (day === 23) {
         const items = row.jsonData;
         if (!items) continue;
         const cadItems = items.filter(i => i.concept === 'CAD');
         for (const c of cadItems) {
            // we want period 19 (which is 18:00-19:00) 
            // Wait, period 1 to 24. Period 1 is 00:00 to 01:00. Period 19 is 18:00 to 19:00.
            if (c.period === 19 || c.period === 18) {
               const cost = Number(c.cost) || Number(c.costObligaciones) || 0;
               const energy = Number(c.energy) || Number(c.energyCompras) || 0;
               if (energy > 0) {
                 console.log(`June 23, Period ${c.period} -> CAD Energy: ${energy.toFixed(3)} MWh, Cost: ${cost.toFixed(3)} €, Rate: ${(cost/energy).toFixed(4)} €/MWh`);
               }
            }
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
