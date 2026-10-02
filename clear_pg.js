const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@pooled.db.prisma.io:5432/postgres?sslmode=require'
  });
  
  await client.connect();
  
  const res = await client.query(`UPDATE "ScrapingJob" SET status = 'COMPLETED' WHERE status IN ('PENDING', 'PROCESSING')`);
  
  console.log('Cleared:', res.rowCount);
  await client.end();
}

main().catch(console.error);
