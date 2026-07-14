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
            let costOblig = 0;
            let costDer = 0;
            let enCompras = 0;
            
            const cVal = Number(c.cost) || 0;
            // From route.ts: signCost = parseFloat(parts[14]) || 1;
            // 1 = Derecho (Cobro), anything else (usually -1) = Obligacion (Pago)
            if (c.signCost === 1) {
                costDer += cVal;
            } else {
                costOblig += cVal;
            }
            
            enCompras += Number(c.energy) || 0;
            
            console.log(`June 23, Period ${c.period} -> Energy: ${enCompras}, CostOblig: ${costOblig}, CostDer: ${costDer}`);
            const netCost = costOblig - costDer;
            if (enCompras > 0) {
               console.log(`  Net Cost: ${netCost.toFixed(3)} €, Rate: ${(netCost/enCompras).toFixed(4)} €/MWh`);
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
