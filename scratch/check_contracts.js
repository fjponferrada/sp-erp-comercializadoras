const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

async function main() {
    await client.connect();
    
    const cupsList = [
        'ES0031101530517001AK0F', // CECILIO
        'ES0031101348132002TP0F', // ANTONIO
        'ES0031101515677003MZ0F', // RAFAEL
        'ES0031101499771003GD0F'  // FIVE SENSES
    ];
    
    const res = await client.query(`
        SELECT sp.cups, c."clientName", c.tariff, c."productType", c."deviationCost", 
               c.p1e, c.p2e, c.p3e, c.p4e, c.p5e, c.p6e,
               c.p1p, c.p2p, c.p3p, c.p4p, c.p5p, c.p6p
        FROM "Contract" c
        JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
        WHERE sp.cups = ANY($1)
    `, [cupsList]);
    
    console.table(res.rows);
    
    await client.end();
}

main().catch(console.error);
