const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

async function main() {
    await client.connect();
    
    const cups = 'ES0031101499771003GD0F'; // FIVE SENSES
    
    // Get Contract details
    const contractRes = await client.query(`
        SELECT c.p1e, c.p2e, c.p3e, c.p4e, c.p5e, c.p6e,
               c.p1p, c.p2p, c.p3p, c.p4p, c.p5p, c.p6p,
               c.fee, c."deviationCost"
        FROM "Contract" c
        JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
        WHERE sp.cups = $1
    `, [cups]);
    
    console.log("=== CONTRACT ===");
    console.log(contractRes.rows[0]);
    
    // Get OUR Invoice (from internal engine)
    const invRes = await client.query(`
        SELECT i."totalAmount", i.subtotal1, i."taxAmount", i."invoiceData"
        FROM "Invoice" i
        JOIN "SupplyPoint" sp ON i."supplyPointId" = sp.id
        WHERE sp.cups = $1
        ORDER BY i."billingStart" DESC
        LIMIT 1
    `, [cups]);
    
    console.log("\n=== OUR INVOICE (ENGINE) ===");
    console.log("Total:", invRes.rows[0].totalAmount);
    console.log("Subtotal:", invRes.rows[0].subtotal1);
    console.log("JSON:", JSON.stringify(invRes.rows[0].invoiceData, null, 2));
    
    await client.end();
}

main().catch(console.error);
