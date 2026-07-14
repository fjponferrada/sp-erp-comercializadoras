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

    let cadCost = 0;
    let cadEnergy = 0;
    let cbmCost = 0;
    let rad3Cost = 0;

    for (let row of res.rows) {
      const items = row.jsonData;
      if (!items) continue;
      
      for (const i of items) {
         if (i.concept === 'CAD' && i.period === 19) {
             cadCost += Number(i.costObligaciones) - Number(i.costDerechos);
             cadEnergy += Number(i.energyCompras) - Number(i.energyVentas);
         }
         
         if (i.concept === 'CBM' && [73, 74, 75, 76].includes(i.period)) {
             cbmCost += Number(i.costObligaciones) - Number(i.costDerechos);
         }
         if (i.concept === 'RAD3' && [73, 74, 75, 76].includes(i.period)) {
             rad3Cost += Number(i.costObligaciones) - Number(i.costDerechos);
         }
      }
    }
    
    console.log("--- Reganecu 18:00 to 19:00 ---");
    console.log(`CAD  Cost: ${cadCost.toFixed(3)} €, Energy: ${cadEnergy.toFixed(3)} MWh`);
    console.log(`CBM  Cost (sum QHs 73-76): ${cbmCost.toFixed(3)} €`);
    console.log(`RAD3 Cost (sum QHs 73-76): ${rad3Cost.toFixed(3)} €`);
    
    const totalCost = cadCost + cbmCost + rad3Cost;
    console.log(`Total System Cost (CAD+CBM+RAD3): ${totalCost.toFixed(3)} €`);
    
    if (cadEnergy > 0) {
        console.log(`Reganecu Effective Rate: ${(totalCost / cadEnergy).toFixed(4)} €/MWh`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
