const { Client } = require('pg');
const client = new Client({
  connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
});

async function run() {
  await client.connect();
  await client.query('UPDATE "SyncJob" SET status = $1, logs = logs || $2 WHERE status IN ($3, $4)', 
    ['ERROR', '\n[SISTEMA] Cancelado para aplicar nueva versión optimizada ultrarrápida.', 'RUNNING', 'PENDING']
  );
  console.log("Updated stuck jobs.");
  await client.end();
}
run().catch(console.error);
