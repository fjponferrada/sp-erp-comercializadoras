const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    // Check TOTAL for June 2026
    const res = await client.query(`
      SELECT "date", "jsonData"
      FROM "ReganecuData"
      WHERE "date" >= '2026-06-01 00:00:00' AND "date" < '2026-07-01 00:00:00'
      AND "matricial" = false
      AND "cierre" = 'A2'
    `);

    let totalCADEnergy = 0;
    let totalOSCost = 0;
    let totalOSIncome = 0;
    
    const conceptsMap = {};

    for (let row of res.rows) {
      const json = row.jsonData;
      if (!json) continue;
      
      for (const [concept, data] of Object.entries(json)) {
         if (!conceptsMap[concept]) conceptsMap[concept] = { cost: 0, income: 0, energy: 0 };
         
         const cost = Number(data.costObligaciones) || 0;
         const income = Number(data.costDerechos) || 0;
         const en = Number(data.energyCompras) || 0;
         
         conceptsMap[concept].cost += cost;
         conceptsMap[concept].income += income;
         
         if (concept === 'CAD') {
             conceptsMap[concept].energy += en;
             totalCADEnergy += en;
         }
         
         // If it's an OS or Restricciones concept (not CAD, not PC3)
         if (['BS3', 'CBM', 'DSV', 'RAD3'].includes(concept)) {
             totalOSCost += cost;
             totalOSIncome += income;
         }
      }
    }

    console.log("\\n--- Summary Month 2026-06 A2 ---");
    for (const [concept, vals] of Object.entries(conceptsMap)) {
        console.log(`${concept.padEnd(6)} | Cost (Pagos a REE): ${vals.cost.toFixed(2)} € | Income (Abonos REE): ${vals.income.toFixed(2)} € | Energy: ${vals.energy.toFixed(2)}`);
    }

    const netOSCost = totalOSCost - totalOSIncome;
    console.log(`\nTotal CAD Energy: ${totalCADEnergy.toFixed(2)} MWh`);
    console.log(`Net OS Cost from REE (BS3+CBM+DSV+RAD3): ${netOSCost.toFixed(2)} €`);
    
    if (totalCADEnergy > 0) {
       console.log(`Effective Rate (Net OS Cost / Total CAD): ${(netOSCost / totalCADEnergy).toFixed(4)} €/MWh`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
