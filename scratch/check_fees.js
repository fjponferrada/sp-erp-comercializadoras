const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

async function main() {
    await client.connect();
    
    const cupsList = [
        'ES0031101530517001AK0F', // CECILIO
        'ES0031101348132002TP0F'  // ANTONIO
    ];
    
    for (const cups of cupsList) {
        const res = await client.query(`
            SELECT c."feeEnergy", c."feePower", c."marginPower", c."marginEnergy", c."deviationCost"
            FROM "Contract" c
            JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
            WHERE sp.cups = $1
        `, [cups]);
        
        console.log("---- CUPS:", cups, "----");
        console.log(res.rows[0]);
    }
    
    await client.end();
}

main().catch(console.error);
