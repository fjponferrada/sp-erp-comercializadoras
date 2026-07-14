const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    const resMatricial = await client.query(`
      SELECT "jsonData"
      FROM "ReganecuData"
      WHERE "date" = '2026-06-23 00:00:00'
      AND "matricial" = true
      AND "cierre" = 'A2'
    `);

    if (resMatricial.rows.length > 0) {
      const data = resMatricial.rows[0];
      const items = data.jsonData;
      
      // Let's filter for 18:00 to 19:00 (periods 73 to 76)
      const periodsToCheck = [73, 74, 75, 76];
      const p18 = items.filter(i => periodsToCheck.includes(i.period));
      
      let totalCost = 0;
      let totalEnergy = 0;
      let totalIncome = 0;

      const conceptAgg = {};
      for (const item of p18) {
         if (!conceptAgg[item.concept]) {
             conceptAgg[item.concept] = { energy: 0, cost: 0, income: 0 };
         }
         
         let costVal = Number(item.cost) || 0;
         let enVal = Number(item.energy) || 0;

         if (item.signCost === 2) {
             conceptAgg[item.concept].cost += costVal;
             totalCost += costVal;
         } else {
             conceptAgg[item.concept].income += costVal;
             totalIncome += costVal;
         }
         
         if (item.concept === 'CAD') {
             if (item.signEnergy === 2) totalEnergy += enVal;
         }
      }

      for (const [concept, vals] of Object.entries(conceptAgg)) {
          console.log(`${concept.padEnd(6)} | Cost (to REE): ${vals.cost.toFixed(2)} | Income (from REE): ${vals.income.toFixed(2)}`);
      }

      console.log("\\n--- Summary Hour 18:00 - 19:00 ---");
      console.log(`Total CAD Energy (Compras): ${totalEnergy} MWh`);
      console.log(`Total Paid to REE: ${totalCost} €`);
      console.log(`Total Received from REE: ${totalIncome} €`);
      const netCost = totalCost - totalIncome;
      console.log(`Net Cost: ${netCost} €`);
      if (totalEnergy > 0) {
         console.log(`Effective Rate: ${(netCost / totalEnergy).toFixed(4)} €/MWh`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
