const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT cups, cau, "selfConsumptionType", "cauSubtype", "cauCollective", 
             cil, "generatorTechnology", "installedPowerGen", "installationType", 
             "meteringScheme", "hasSelfConsumption" 
      FROM "SupplyPoint" 
      WHERE cups LIKE 'ES0031105584375001HJ0F%' 
      LIMIT 1
    `);
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
