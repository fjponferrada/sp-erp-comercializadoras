const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
});

async function run() {
  await client.connect();
  const cRes = await client.query('SELECT id, cups, p1c, p2c, p3c, p4c, p5c, p6c FROM "SupplyPoint" WHERE cups = \'ES0031105131691001XN0F\'');
  console.log(cRes.rows);
  await client.end();
}

run().catch(console.error);
