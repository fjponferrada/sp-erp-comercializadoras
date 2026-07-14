const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

async function main() {
    await client.connect();
    
    const cups = 'ES0031101499771003GD0F'; // FIVE SENSES
    
    const invRes = await client.query(`
        SELECT i."totalAmount", i.subtotal1, i."taxAmount"
        FROM "Invoice" i
        JOIN "SupplyPoint" sp ON i."supplyPointId" = sp.id
        WHERE sp.cups = $1
        ORDER BY i."billingStart" DESC
        LIMIT 1
    `, [cups]);
    
    console.log("OUR INVOICE:");
    console.log(invRes.rows[0]);
    
    await client.end();
}

main().catch(console.error);
