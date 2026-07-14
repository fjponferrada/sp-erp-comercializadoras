const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

const records = [
    // 2024 PAGOS CAPACIDAD
    { y: 2024, t: '2.0TD', p: [0.000926, 0.000154, 0, 0, 0, 0] },
    { y: 2024, t: '3.0TD', p: [0.001251, 0.000578, 0.000385, 0.000289, 0.000289, 0] },
    { y: 2024, t: '6.1TD', p: [0.000537, 0.000247, 0.000165, 0.000124, 0.000124, 0] },
    { y: 2024, t: '6.2TD', p: [0.000537, 0.000247, 0.000165, 0.000124, 0.000124, 0] },
    { y: 2024, t: '6.3TD', p: [0.000537, 0.000247, 0.000165, 0.000124, 0.000124, 0] },
    { y: 2024, t: '6.4TD', p: [0.000537, 0.000247, 0.000165, 0.000124, 0.000124, 0] },
    { y: 2024, t: '3.0TDVE', p: [0.001251, 0.000578, 0.000385, 0.000289, 0.000289, 0] },
    { y: 2024, t: '6.1TDVE', p: [0.000537, 0.000247, 0.000165, 0.000124, 0.000124, 0] },

    // 2025 PAGOS CAPACIDAD
    { y: 2025, t: '2.0TD', p: [0.000844, 0.000140, 0, 0, 0, 0] },
    { y: 2025, t: '3.0TD', p: [0.001141, 0.000527, 0.000351, 0.000264, 0.000264, 0] },
    { y: 2025, t: '6.1TD', p: [0.000490, 0.000225, 0.000150, 0.000113, 0.000113, 0] },
    { y: 2025, t: '6.2TD', p: [0.000490, 0.000225, 0.000150, 0.000113, 0.000113, 0] },
    { y: 2025, t: '6.3TD', p: [0.000490, 0.000225, 0.000150, 0.000113, 0.000113, 0] },
    { y: 2025, t: '6.4TD', p: [0.000490, 0.000225, 0.000150, 0.000113, 0.000113, 0] },
    { y: 2025, t: '3.0TDVE', p: [0.001141, 0.000527, 0.000351, 0.000264, 0.000264, 0] },
    { y: 2025, t: '6.1TDVE', p: [0.000490, 0.000225, 0.000150, 0.000113, 0.000113, 0] }
];

async function main() {
    await client.connect();
    
    for (const d of records) {
        const id = 'cap_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        const tariff = d.t.replace(' ', '');
        let validFrom, validTo;
        if (d.y === 2024) {
            validFrom = '2024-01-01'; // Used 01/01/24 to prevent holes
            validTo = '2024-12-31';
        } else if (d.y === 2025) {
            validFrom = '2025-01-01';
            validTo = '2025-12-31';
        }
        
        await client.query(`
            INSERT INTO "RegulatedCost" (id, concept, tariff, "validFrom", "validTo", p1, p2, p3, p4, p5, p6, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        `, [id, 'Pagos_Capacidad', tariff, validFrom, validTo, d.p[0], d.p[1], d.p[2], d.p[3], d.p[4], d.p[5]]);
    }
    
    console.log("Successfully inserted", records.length, "Pagos Capacidad records.");
    
    await client.end();
}

main().catch(console.error);
