const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    // Look for June 23, 2026 in ReganecuData (TOTAL)
    const res = await client.query(`
      SELECT "jsonData", "cierre"
      FROM "ReganecuData"
      WHERE "date" = '2026-06-23 00:00:00'
      AND "matricial" = false
      AND "cierre" = 'A2'
    `);

    if (res.rows.length > 0) {
      const data = res.rows[0];
      const json = data.jsonData;
      console.log("Cierre:", data.cierre);
      
      // The structure of jsonData in TOTAL is:
      // json[concept] = { energyVentas, energyCompras, costDerechos, costObligaciones, count }
      // This is AGGREGATED for the WHOLE DAY! Wait! 
      // In src/app/api/reganecu/import/route.ts, for "TOTAL" it aggregates over ALL lines of the day!
      // So "TOTAL" does NOT have hourly data.
      // Hourly data is in "MATRICIAL", where "period" corresponds to the hour (1-24) or quarter-hour (1-96).
    }

    // Let's query MATRICIAL data for the same day
    const resMatricial = await client.query(`
      SELECT "jsonData"
      FROM "ReganecuData"
      WHERE "date" = '2026-06-23 00:00:00'
      AND "matricial" = true
      AND "cierre" = 'A2'
    `);

    if (resMatricial.rows.length > 0) {
      const data = resMatricial.rows[0];
      const items = data.jsonData; // Array of { period, unit, upr, concept, energy, price, cost, signEnergy, signCost }
      
      // Let's filter for hour 18 (period 18 or 18*4 for QH?)
      // We will group by concept for a specific period
      // Wait, is period 1-24? Let's check what periods exist.
      const periods = new Set(items.map(i => i.period));
      console.log("Periods found:", Array.from(periods).slice(0, 5));
      
      // Let's pick period = 18
      const p18 = items.filter(i => i.period === 18);
      
      let totalCost = 0;
      let totalEnergy = 0;
      let totalIncome = 0;

      console.log("\\n--- Detail for Period 18 ---");
      // Aggregate by concept
      const conceptAgg = {};
      for (const item of p18) {
         if (!conceptAgg[item.concept]) {
             conceptAgg[item.concept] = { energy: 0, cost: 0, income: 0 };
         }
         
         // Assuming signCost === 2 means Obligacion (pago a REE), 1 means Derecho (cobro de REE)
         // signEnergy: 2 means Consumo (compras), 1 means Generacion (ventas)
         if (item.signCost === 2) {
             conceptAgg[item.concept].cost += item.cost;
             totalCost += item.cost;
         } else {
             conceptAgg[item.concept].income += item.cost;
             totalIncome += item.cost;
         }
         
         if (item.concept === 'CAD') {
             if (item.signEnergy === 2) totalEnergy += item.energy;
         }
      }

      for (const [concept, vals] of Object.entries(conceptAgg)) {
          console.log(`${concept.padEnd(6)} | Cost: ${vals.cost.toFixed(2)} | Income: ${vals.income.toFixed(2)}`);
      }

      console.log("\\n--- Summary Period 18 ---");
      console.log(`Total CAD Energy (Compras): ${totalEnergy} MWh`);
      console.log(`Total Paid to REE (Costes): ${totalCost} €`);
      console.log(`Total Received from REE (Ingresos): ${totalIncome} €`);
      const netCost = totalCost - totalIncome;
      console.log(`Net Cost to REE: ${netCost} €`);
      if (totalEnergy > 0) {
         console.log(`Effective Rate: ${(netCost / totalEnergy).toFixed(4)} €/MWh`);
      }
    } else {
      console.log("No MATRICIAL data found for 2026-06-23 A2");
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
