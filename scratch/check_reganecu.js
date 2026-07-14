const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    // Look for June 23, 2026 in ReganecuData
    // We want to see if IMP_TOTAL = SUM(IMP_*) including the negative ones
    const res = await client.query(`
      SELECT "date", "cierre", "matricial", "jsonData"
      FROM "ReganecuData"
      WHERE "date" >= '2026-06-23 00:00:00' AND "date" < '2026-06-24 00:00:00'
      AND "matricial" = false
      LIMIT 1
    `);

    if (res.rows.length > 0) {
      const data = res.rows[0];
      console.log("Found ReganecuData:", data.cierre, data.matricial);
      // jsonData has an array of 24/25 hours, each is an object
      const h17 = data.jsonData[17];
      if (h17) {
        console.log("Hour 17 (18:00) components:");
        const keys = Object.keys(h17).filter(k => k.startsWith('IMP_'));
        let sum = 0;
        for (let k of keys) {
          if (k !== 'IMP_TOTAL') {
             sum += h17[k];
             if (['IMP_RAD1', 'IMP_SECX', 'IMP_MI', 'IMP_RAD3', 'IMP_BS3'].includes(k) || h17[k] < 0) {
               console.log(`  ${k}: ${h17[k]}`);
             }
          }
        }
        console.log(`\nCalculated Sum of all IMP_* (excluding IMP_TOTAL): ${sum}`);
        console.log(`Actual IMP_TOTAL from REE: ${h17['IMP_TOTAL']}`);
      } else {
        console.log("No Hour 17 data.");
      }
    } else {
      console.log("No ReganecuData found for 2026-06-23");
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
