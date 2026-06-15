const { Client } = require('pg');

const client = new Client({
  connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require"
});

async function main() {
  await client.connect();
  const res = await client.query("SELECT * FROM \"SwitchingEvent\" WHERE cups = 'ES0031101654201001PA0F' OR \"uniqueProcess\" LIKE '%ES0031101654201001PA0F%'");
  console.log("EVENTS:", res.rows);
  const c = await client.query("SELECT id, status FROM \"Contract\" WHERE \"supplyPointId\" IN (SELECT id FROM \"SupplyPoint\" WHERE cups = 'ES0031101654201001PA0F')");
  console.log("CONTRACT:", c.rows);
  await client.end();
}

main().catch(console.error);
