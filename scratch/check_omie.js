const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

async function main() {
    await client.connect();
    const res = await client.query(`
        SELECT min(date) as min_date, max(date) as max_date
        FROM "SystemComponentPrice"
        WHERE date >= '2026-06-01' AND date <= '2026-07-31'
    `);
    console.log("SystemComponentPrice:", res.rows[0]);
    await client.end();
}
main().catch(console.error);
