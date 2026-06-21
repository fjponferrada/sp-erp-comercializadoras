import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT DISTINCT type, tariff FROM "Product" LIMIT 20');
    console.log(res.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
