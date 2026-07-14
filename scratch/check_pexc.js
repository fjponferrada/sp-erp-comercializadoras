const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

async function main() {
    await client.connect();
    
    const res = await client.query(`
        SELECT c.pexc, c."airtableData"
        FROM "Contract" c
        JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
        WHERE sp.cups = 'ES0031101499771003GD0F'
    `);
    
    console.log("PEXC:");
    console.log(res.rows[0].pexc);
    console.log("PEXC in Airtable:");
    const air = res.rows[0].airtableData;
    console.log(air ? air['PEXC'] || air['PRECIO PEXC'] || air['PEXC (from PRODUCTOS)'] : 'No airtable data');

    await client.end();
}

main().catch(console.error);
