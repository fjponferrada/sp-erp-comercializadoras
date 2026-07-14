const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

async function main() {
    await client.connect();
    
    // Update validFrom to 2026-01-01 (Madrid time: 2025-12-31T23:00:00.000Z)
    // for all costs except PERDIDAS which start in 2019
    const res = await client.query(`
        UPDATE "RegulatedCost" 
        SET "validFrom" = '2025-12-31T23:00:00.000Z'
        WHERE "validFrom" = '2024-12-31T23:00:00.000Z'
    `);
    console.log("Updated rows:", res.rowCount);
    
    await client.end();
}

main().catch(console.error);
