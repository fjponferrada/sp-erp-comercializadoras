const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

async function main() {
    await client.connect();
    
    const res = await client.query(`
        SELECT c.p1p, c.p2p, c.p3p, c.p4p, c.p5p, c.p6p
        FROM "Contract" c
        JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
        WHERE sp.cups = 'ES0031101499771003GD0F'
    `);
    
    console.log("CONTRACT POWER PRICES:");
    console.log(res.rows[0]);

    await client.end();
}

main().catch(console.error);
