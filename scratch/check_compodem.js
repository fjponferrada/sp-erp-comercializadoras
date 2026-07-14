const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    // Look for June 23, 2026, component = MI, SECX, RAD1, BS3, etc
    const res = await client.query(`
      SELECT "component", "values"
      FROM "SystemComponentPrice"
      WHERE "date" = '2026-06-23 00:00:00'
      AND "component" IN ('MI', 'SECX', 'RAD1', 'OS', 'BS3', 'RAD3', 'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP', 'RESTRICCIONES')
    `);

    console.log("Components for 2026-06-23:");
    for (let row of res.rows) {
      // The hour we are comparing is 18:00 (which is index 17 if 1-24, or 18 if 0-23?)
      // Let's print the value at index 17 and 18 to be sure
      console.log(`${row.component.padEnd(15)} | h17: ${row.values[17]} | h18: ${row.values[18]}`);
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
