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
         
         const targetConcepts = ['CAD', 'CBM', 'RAD3'];
         const p18Items = items.filter(i => targetConcepts.includes(i.concept) && i.period === 18);
         const p19Items = items.filter(i => targetConcepts.includes(i.concept) && i.period === 19);
         
         for (const period of [18, 19]) {
             const periodItems = period === 18 ? p18Items : p19Items;
             let netCost = 0;
             let energy = 0;
             
             console.log(`\\n--- Period ${period} ---`);
             for (const c of periodItems) {
                 const cost = Number(c.cost) || Number(c.costObligaciones) || 0;
                 const income = Number(c.costDerechos) || (c.signCost === 1 ? cost : 0);
                 const finalCost = c.signCost === 1 ? -cost : cost; // If 1 it's income (negative cost)
                 
                 const en = Number(c.energy) || Number(c.energyCompras) || 0;
                 
                 console.log(`${c.concept.padEnd(5)} | Cost: ${finalCost.toFixed(3)} | Energy: ${en.toFixed(3)}`);
                 
                 netCost += finalCost;
                 if (c.concept === 'CAD') {
                     energy += en;
                 }
             }
             
             if (energy > 0) {
                 console.log(`Total Net Cost (CBM+RAD3+CAD): ${netCost.toFixed(3)} €`);
                 console.log(`Total CAD Energy: ${energy.toFixed(3)} MWh`);
                 console.log(`Rate: ${(netCost/energy).toFixed(4)} €/MWh`);
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
