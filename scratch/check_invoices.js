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
            SELECT i.id, i."totalAmount", i."billingStart", i."billingEnd",
                   i."subtotal1", i."taxAmount", i."taxPercentage", i."invoiceData"
            FROM "Invoice" i
            JOIN "SupplyPoint" sp ON i."supplyPointId" = sp.id
            WHERE sp.cups = $1
            ORDER BY i."billingStart" DESC
            LIMIT 1
        `, [cups]);
        
        console.log("---- CUPS:", cups, "----");
        for (const row of res.rows) {
            console.log("Total Amount:", row.totalAmount);
            console.log("JSON DATA:");
            console.log(JSON.stringify(row.invoiceData, null, 2));
            console.log("-------------");
        }
    }
    
    await client.end();
}

main().catch(console.error);
