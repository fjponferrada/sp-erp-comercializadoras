const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });
  await client.connect();
  const res = await client.query("UPDATE "Contract" SET "tipoC2" = 'S' WHERE "contractCode" = 'PRJAV26210193FJ0F'");
  console.log('Rows updated:', res.rowCount);
  await client.end();
}
run().catch(console.error);
