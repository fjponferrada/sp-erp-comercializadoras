const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    // Check MATRICIAL for June 23, 2026
    const res = await client.query(`
      SELECT "jsonData"
      FROM "ReganecuData"
      WHERE "date" = '2026-06-23 00:00:00'
      AND "matricial" = true
      AND "cierre" = 'A2'
    `);

    if (res.rows.length > 0) {
      const items = res.rows[0].jsonData;
      
      // Let's take Quarter Hours 73, 74, 75, 76 (which is 18:00 to 19:00)
      const targetPeriods = [73, 74, 75, 76];
      const filtered = items.filter(i => targetPeriods.includes(i.period));

      let totalCost = 0;
      let totalIncome = 0;
      let energy = 0;

      const agg = {};
      for (let item of filtered) {
        if (!agg[item.concept]) agg[item.concept] = { cost: 0, income: 0 };
        const c = Number(item.cost) || 0;
        if (item.signCost === 2) {
            agg[item.concept].cost += c;
            totalCost += c;
        } else {
            agg[item.concept].income += c;
            totalIncome += c;
        }
        
        if (item.concept === 'DSV' || item.concept === 'BS3' || item.concept === 'RAD3') {
           // just summing up the euros
        }
      }

      console.log("\\n--- Hour 18:00 to 19:00 (Periods 73-76) MATRICIAL ---");
      for (const [c, v] of Object.entries(agg)) {
         console.log(`${c.padEnd(5)} | Cost (Pagos a REE): ${v.cost.toFixed(2)} € | Income (Abonos REE): ${v.income.toFixed(2)} €`);
      }
      
      // Now let's see what the total energy for the day was, to estimate energy per hour?
      // No, REGANECU doesn't have hourly CAD in Matricial.
      // But we can just say "The total paid to REE for OS concepts in this hour was X euros".
      console.log(`\nNet Cost for OS concepts (BS3, RAD3, DSV) in this hour: ${(totalCost - totalIncome).toFixed(2)} €`);
    } else {
      console.log("No data");
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
