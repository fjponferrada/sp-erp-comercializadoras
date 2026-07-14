const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

async function main() {
    await client.connect();
    
    // Average price June
    const resJune = await client.query(`
        SELECT AVG(value) as avg_price
        FROM "SystemComponentPrice"
        WHERE date >= '2026-06-01' AND date < '2026-07-01' AND component = 'OMIE'
    `);
    
    // Average price July 1-4
    const resJuly = await client.query(`
        SELECT AVG(value) as avg_price
        FROM "SystemComponentPrice"
        WHERE date >= '2026-07-01' AND date <= '2026-07-04' AND component = 'OMIE'
    `);
    
    console.log("Average OMIE June:", resJune.rows[0].avg_price);
    console.log("Average OMIE July 1-4:", resJuly.rows[0].avg_price);
    
    await client.end();
}

main().catch(console.error);
