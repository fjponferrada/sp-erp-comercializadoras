const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    // Check Compodem (SystemComponentPrice) for June 23, 2026 Hour 18
    const res = await client.query(`
      SELECT "component", "values"
      FROM "SystemComponentPrice"
      WHERE "date" = '2026-06-23 00:00:00'
    `);

    console.log("Compodem Raw Values for 2026-06-23:");
    let sumOS = 0;
    for (let row of res.rows) {
      // In JS, hours are 0-23. If Period 19 in Reganecu is 18:00 to 19:00, that is index 18 in the array (if array is 0-23).
      // Let's print index 17 and 18 just in case.
      const val17 = row.values[17];
      const val18 = row.values[18];
      console.log(`${row.component.padEnd(15)} | idx 17 (17:00): ${val17} | idx 18 (18:00): ${val18}`);
      
      if (['BS3', 'RAD3', 'RAD1', 'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP', 'MI', 'SECX'].includes(row.component)) {
         sumOS += val18;
      }
    }
    
    console.log(`\nSum of cols_os at index 18: ${sumOS}`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
