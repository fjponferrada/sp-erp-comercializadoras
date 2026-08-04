import { Client } from 'pg';

async function run() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });

  try {
    await client.connect();
    
    const query = `SELECT * FROM "Invoice" WHERE "issueDate" >= '2026-04-01' LIMIT 1`;
    const res = await client.query(query);
    console.log(res.rows[0]);

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
