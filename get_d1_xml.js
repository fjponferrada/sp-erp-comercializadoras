const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT "rawXml"
      FROM "SwitchingEvent" 
      WHERE "cups" = 'ES0031105584375001HJ0F' AND "step" = '01' AND "process" LIKE 'D1%'
      ORDER BY "createdAt" DESC
      LIMIT 1
    `);
    if (res.rows.length > 0) {
      console.log(res.rows[0].rawXml);
    } else {
      console.log("No D1 XML found for that CUPS.");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
