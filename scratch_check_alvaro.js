const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT id, status, "contractCode", "pricingModel", "fee", "deviationCost", p1e, p2e, p3e, p4e, p5e, p6e, "airtableData"
    FROM "Contract"
    WHERE "supplyPointId" = (SELECT id FROM "SupplyPoint" WHERE cups = 'ES0031104899528001TR0F')
    AND status = 'ACTIVO'
  `);
  console.log("Contract for ES0031104899528001TR0F:", JSON.stringify(res.rows, null, 2));
  await client.end();
}

run().catch(console.error);
