const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT \"invoiceNumber\", \"origin\", \"invoiceData\"->>'Procedencia Hasta' as proc FROM \"Invoice\" WHERE \"invoiceNumber\" IN ('A260614793', 'A260614877', 'A260615017')");
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run();
