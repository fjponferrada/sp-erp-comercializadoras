const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

const powerData = [
  { tariff: '2.0TD', p1: 27.704413, p2: 0.725423, p3: 0, p4: 0, p5: 0, p6: 0 },
  { tariff: '3.0TD', p1: 20.376927, p2: 10.617621, p3: 4.481534, p4: 3.886333, p5: 2.513851, p6: 1.442287 },
  { tariff: '6.1TD', p1: 29.595368, p2: 15.514709, p3: 6.801881, p4: 5.393829, p5: 2.125113, p6: 1.004181 },
  { tariff: '6.2TD', p1: 20.103588, p2: 11.115668, p3: 3.709113, p4: 2.728152, p5: 1.265617, p6: 0.605381 },
  { tariff: '6.3TD', p1: 13.053392, p2: 7.587863, p3: 3.062065, p4: 2.332116, p5: 1.010041, p6: 0.481394 },
  { tariff: '6.4TD', p1: 7.905445, p2: 4.585787, p3: 1.460005, p4: 1.158560, p5: 0.492827, p6: 0.230511 },
  { tariff: '3.0TDVE', p1: 3.727958, p2: 1.968328, p3: 0.623462, p4: 0.471799, p5: 0.130238, p6: 0.130238 },
  { tariff: '6.1TDVE', p1: 5.523814, p2: 2.926765, p3: 1.095280, p4: 0.770513, p5: 0.016375, p6: 0.014472 },
  { tariff: '6.2TDVE', p1: 3.773717, p2: 2.125824, p3: 0.562648, p4: 0.342155, p5: 0.013350, p6: 0.011815 }
];

async function main() {
    await client.connect();
    
    // We will insert the sum directly into 'Peajes_Potencia' and leave 'Cargos_Potencia' as 0 implicitly (not needed since getRegVal defaults to 0).
    const validFrom = '2025-12-31T23:00:00.000Z'; // 01/01/2026 Madrid time
    const validTo = '2030-12-30T23:00:00.000Z';
    const concept = 'Peajes_Potencia';
    
    for (const d of powerData) {
        // use cuid for id in postgres? We can generate a simple unique id
        const id = 'potencia_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        await client.query(`
            INSERT INTO "RegulatedCost" (id, concept, tariff, "validFrom", "validTo", p1, p2, p3, p4, p5, p6, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        `, [id, concept, d.tariff, validFrom, validTo, d.p1, d.p2, d.p3, d.p4, d.p5, d.p6]);
        console.log("Inserted Peajes_Potencia for", d.tariff);
    }
    
    await client.end();
}

main().catch(console.error);
