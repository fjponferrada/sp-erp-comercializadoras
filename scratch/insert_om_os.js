const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

const tariffs = ['2.0TD', '3.0TD', '6.1TD', '6.2TD', '6.3TD', '6.4TD', '3.0TDVE', '6.1TDVE', '6.2TDVE'];

const records = [
    // 2024
    { y: 2024, c: 'Pago_OM', v: 0.00004096 },
    { y: 2024, c: 'Pago_OS', v: 0.00017498 },
    { y: 2024, c: 'FNEE', v: 0.000980 },
    // 2025
    { y: 2025, c: 'Pago_OM', v: 0.00004096 },
    { y: 2025, c: 'Pago_OS', v: 0.00016853 },
    { y: 2025, c: 'FNEE', v: 0.001430 }
];

async function main() {
    await client.connect();
    
    let count = 0;
    
    for (const d of records) {
        let validFrom, validTo;
        if (d.y === 2024) {
            validFrom = '2024-01-01'; // Defaulting to 1st Jan to prevent holes
            validTo = '2024-12-31';
        } else if (d.y === 2025) {
            validFrom = '2025-01-01';
            validTo = '2025-12-31';
        }
        
        for (const t of tariffs) {
            const id = 'om_os_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
            await client.query(`
                INSERT INTO "RegulatedCost" (id, concept, tariff, "validFrom", "validTo", p1, p2, p3, p4, p5, p6, "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
            `, [id, d.c, t, validFrom, validTo, d.v, d.v, d.v, d.v, d.v, d.v]);
            count++;
        }
    }
    
    console.log("Successfully inserted", count, "OM, OS and FNEE records.");
    
    await client.end();
}

main().catch(console.error);
