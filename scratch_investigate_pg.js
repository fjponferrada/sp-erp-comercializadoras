const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
});

async function run() {
  await client.connect();
  const cRes = await client.query('SELECT id, status, "activationDate", "terminationDate" FROM "Contract" WHERE id IN (\'cmq6zh21r0ythic41lmfhoqpo\', \'cmq6yg7sn05unic41ue5dwlwr\')');
  console.log(cRes.rows);
  await client.end();
}

run().catch(console.error);
