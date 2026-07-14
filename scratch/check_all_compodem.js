const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    const res = await client.query(`
      SELECT "component", "values"
      FROM "SystemComponentPrice"
      WHERE "date" = '2026-06-23 00:00:00'
    `);

    let osSums = Array(24).fill(0);
    let restriccionesSums = Array(24).fill(0);

    for (let row of res.rows) {
      const c = row.component;
      for (let i = 0; i < 24; i++) {
         const val = row.values[i] || 0;
         if (['BS3', 'RAD3', 'RAD1', 'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP', 'MI', 'SECX'].includes(c)) {
            osSums[i] += val;
         }
         if (['RT3', 'RT6', 'CT2', 'CT3'].includes(c)) {
            restriccionesSums[i] += val;
         }
      }
    }
    
    for (let i = 0; i < 24; i++) {
       const total = osSums[i] + restriccionesSums[i];
       console.log(`Compodem Hour ${i} (Period ${i+1}): ${total.toFixed(4)} €/MWh`);
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
