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

    let totalCost18 = 0, totalEnergy18 = 0;
    let totalCost19 = 0, totalEnergy19 = 0;
    
    // Aggregates
    const agg18 = {};
    const agg19 = {};

    for (let row of res.rows) {
      const date = new Date(row.date);
      const day = date.getUTCDate();
      if (day === 23) {
         const items = row.jsonData;
         if (!items) continue;
         
         const targetConcepts = ['CAD', 'CBM', 'RAD3'];
         for (const c of items) {
             if (!targetConcepts.includes(c.concept)) continue;
             if (c.period !== 18 && c.period !== 19) continue;
             
             const cost = Number(c.cost) || Number(c.costObligaciones) || 0;
             const finalCost = c.signCost === 1 ? -cost : cost;
             const en = Number(c.energy) || Number(c.energyCompras) || 0;
             
             if (c.period === 18) {
                 if (!agg18[c.concept]) agg18[c.concept] = { cost: 0, energy: 0 };
                 agg18[c.concept].cost += finalCost;
                 if (c.concept === 'CAD') agg18[c.concept].energy += en;
             } else if (c.period === 19) {
                 if (!agg19[c.concept]) agg19[c.concept] = { cost: 0, energy: 0 };
                 agg19[c.concept].cost += finalCost;
                 if (c.concept === 'CAD') agg19[c.concept].energy += en;
             }
         }
      }
    }
    
    console.log("\\n--- Period 18 (17:00-18:00) ---");
    let net18 = 0;
    let en18 = 0;
    for (const [k, v] of Object.entries(agg18)) {
       console.log(`${k.padEnd(5)} | Cost: ${v.cost.toFixed(3)} | Energy (CAD): ${v.energy.toFixed(3)}`);
       net18 += v.cost;
       en18 += v.energy;
    }
    console.log(`Total Net Cost (CBM+RAD3+CAD): ${net18.toFixed(3)} €`);
    console.log(`Total CAD Energy: ${en18.toFixed(3)} MWh`);
    if (en18 > 0) console.log(`Rate: ${(net18/en18).toFixed(4)} €/MWh`);
    
    console.log("\\n--- Period 19 (18:00-19:00) ---");
    let net19 = 0;
    let en19 = 0;
    for (const [k, v] of Object.entries(agg19)) {
       console.log(`${k.padEnd(5)} | Cost: ${v.cost.toFixed(3)} | Energy (CAD): ${v.energy.toFixed(3)}`);
       net19 += v.cost;
       en19 += v.energy;
    }
    console.log(`Total Net Cost (CBM+RAD3+CAD): ${net19.toFixed(3)} €`);
    console.log(`Total CAD Energy: ${en19.toFixed(3)} MWh`);
    if (en19 > 0) console.log(`Rate: ${(net19/en19).toFixed(4)} €/MWh`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
