const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

const records = [
    // 2024 CARGOS
    { y: 2024, c: 'Cargos_Potencia', t: '2.0TD', p: [2.989915, 0.192288, 0, 0, 0, 0] },
    { y: 2024, c: 'Cargos_Potencia', t: '3.0TD', p: [3.715217, 1.859231, 1.350774, 1.350774, 1.350774, 0.619203] },
    { y: 2024, c: 'Cargos_Potencia', t: '6.1TD', p: [3.856557, 1.930027, 1.402384, 1.402384, 1.402384, 0.642759] },
    { y: 2024, c: 'Cargos_Potencia', t: '6.2TD', p: [2.264702, 1.133557, 0.823528, 0.823528, 0.823528, 0.377450] },
    { y: 2024, c: 'Cargos_Potencia', t: '6.3TD', p: [1.813304, 0.907425, 0.659281, 0.659281, 0.659281, 0.302217] },
    { y: 2024, c: 'Cargos_Potencia', t: '6.4TD', p: [0.887008, 0.443874, 0.322548, 0.322548, 0.322548, 0.147835] },
    { y: 2024, c: 'Cargos_Potencia', t: '3.0TDVE', p: [0, 0, 0, 0, 0, 0] },
    { y: 2024, c: 'Cargos_Potencia', t: '6.1TDVE', p: [0, 0, 0, 0, 0, 0] },
    // 2024 PEAJES
    { y: 2024, c: 'Peajes_Potencia', t: '2.0TD', p: [22.401746, 0.776564, 0, 0, 0, 0] },
    { y: 2024, c: 'Peajes_Potencia', t: '3.0TD', p: [11.997830, 7.687805, 3.307437, 2.791786, 0.934435, 0.934435] },
    { y: 2024, c: 'Peajes_Potencia', t: '6.1TD', p: [20.557850, 12.762884, 9.926251, 7.848380, 0.325141, 0.325141] },
    { y: 2024, c: 'Peajes_Potencia', t: '6.2TD', p: [13.138413, 8.751207, 5.615670, 4.671118, 0.238475, 0.238475] },
    { y: 2024, c: 'Peajes_Potencia', t: '6.3TD', p: [10.474293, 6.510420, 5.241724, 4.138835, 0.341465, 0.341465] },
    { y: 2024, c: 'Peajes_Potencia', t: '6.4TD', p: [7.310560, 4.116430, 3.161822, 2.877385, 0.194493, 0.194493] },
    { y: 2024, c: 'Peajes_Potencia', t: '3.0TDVE', p: [3.042554, 1.950529, 0.839499, 0.707882, 0.232710, 0.232710] },
    { y: 2024, c: 'Peajes_Potencia', t: '6.1TDVE', p: [4.656308, 2.890792, 2.248322, 1.777672, 0.073645, 0.073645] },
    // 2025 CARGOS
    { y: 2025, c: 'Cargos_Potencia', t: '2.0TD', p: [3.971618, 0.255423, 0, 0, 0, 0] },
    { y: 2025, c: 'Cargos_Potencia', t: '3.0TD', p: [4.935064, 2.469687, 1.794284, 1.794284, 1.794284, 0.822511] },
    { y: 2025, c: 'Cargos_Potencia', t: '6.1TD', p: [5.122811, 2.563728, 1.862840, 1.862840, 1.862840, 0.853802] },
    { y: 2025, c: 'Cargos_Potencia', t: '6.2TD', p: [3.008289, 1.505746, 1.093923, 1.093923, 1.093923, 0.501382] },
    { y: 2025, c: 'Cargos_Potencia', t: '6.3TD', p: [2.408681, 1.205367, 0.875748, 0.875748, 0.875748, 0.401447] },
    { y: 2025, c: 'Cargos_Potencia', t: '6.4TD', p: [1.178247, 0.589615, 0.428453, 0.428453, 0.428453, 0.196374] },
    { y: 2025, c: 'Cargos_Potencia', t: '3.0TDVE', p: [0, 0, 0, 0, 0, 0] },
    { y: 2025, c: 'Cargos_Potencia', t: '6.1TDVE', p: [0, 0, 0, 0, 0, 0] },
    // 2025 PEAJES
    { y: 2025, c: 'Peajes_Potencia', t: '2.0TD', p: [22.958932, 0.442165, 0, 0, 0, 0] },
    { y: 2025, c: 'Peajes_Potencia', t: '3.0TD', p: [14.723431, 7.781964, 2.468252, 1.887267, 0.533883, 0.533883] },
    { y: 2025, c: 'Peajes_Potencia', t: '6.1TD', p: [23.669055, 12.513915, 4.696330, 3.309245, 0.069965, 0.062286] },
    { y: 2025, c: 'Peajes_Potencia', t: '6.2TD', p: [16.620368, 9.426053, 2.481516, 1.512028, 0.059278, 0.052654] },
    { y: 2025, c: 'Peajes_Potencia', t: '6.3TD', p: [10.791377, 6.502236, 2.118318, 1.380541, 0.045332, 0.039905] },
    { y: 2025, c: 'Peajes_Potencia', t: '6.4TD', p: [6.590215, 3.939980, 0.956817, 0.665081, 0.019779, 0.013181] },
    { y: 2025, c: 'Peajes_Potencia', t: '3.0TDVE', p: [3.696817, 1.951831, 0.618477, 0.469626, 0.130795, 0.130795] },
    { y: 2025, c: 'Peajes_Potencia', t: '6.1TDVE', p: [5.460600, 2.887083, 1.083564, 0.763585, 0.016143, 0.014376] },
    // 2026 CARGOS
    { y: 2026, c: 'Cargos_Potencia', t: '2.0TD', p: [4.379461, 0.281653, 0, 0, 0, 0] },
    { y: 2026, c: 'Cargos_Potencia', t: '3.0TD', p: [5.441843, 2.723298, 1.978538, 1.978538, 1.978538, 0.906974] },
    { y: 2026, c: 'Cargos_Potencia', t: '6.1TD', p: [5.648870, 2.826996, 2.054134, 2.054134, 2.054134, 0.941478] },
    { y: 2026, c: 'Cargos_Potencia', t: '6.2TD', p: [3.317209, 1.660371, 1.206258, 1.206258, 1.206258, 0.552868] },
    { y: 2026, c: 'Cargos_Potencia', t: '6.3TD', p: [2.656027, 1.329146, 0.965679, 0.965679, 0.965679, 0.442671] },
    { y: 2026, c: 'Cargos_Potencia', t: '6.4TD', p: [1.299240, 0.650162, 0.472451, 0.472451, 0.472451, 0.216540] },
    { y: 2026, c: 'Cargos_Potencia', t: '3.0TDVE', p: [0, 0, 0, 0, 0, 0] },
    { y: 2026, c: 'Cargos_Potencia', t: '6.1TDVE', p: [0, 0, 0, 0, 0, 0] },
    // 2026 PEAJES
    { y: 2026, c: 'Peajes_Potencia', t: '2.0TD', p: [23.324952, 0.443770, 0, 0, 0, 0] },
    { y: 2026, c: 'Peajes_Potencia', t: '3.0TD', p: [14.935084, 7.894323, 2.502996, 1.907795, 0.535313, 0.535313] },
    { y: 2026, c: 'Peajes_Potencia', t: '6.1TD', p: [23.946498, 12.687713, 4.747747, 3.339695, 0.070979, 0.062703] },
    { y: 2026, c: 'Peajes_Potencia', t: '6.2TD', p: [16.786379, 9.455297, 2.502855, 1.521894, 0.059359, 0.052513] },
    { y: 2026, c: 'Peajes_Potencia', t: '6.3TD', p: [10.397365, 6.258717, 2.096386, 1.366437, 0.044362, 0.038723] },
    { y: 2026, c: 'Peajes_Potencia', t: '6.4TD', p: [6.606205, 3.935625, 0.987554, 0.686109, 0.020376, 0.013971] },
    { y: 2026, c: 'Peajes_Potencia', t: '3.0TDVE', p: [3.727958, 1.968328, 0.623462, 0.471799, 0.130238, 0.130238] },
    { y: 2026, c: 'Peajes_Potencia', t: '6.1TDVE', p: [5.523814, 2.926765, 1.095280, 0.770513, 0.016375, 0.014472] }
];

async function main() {
    await client.connect();
    
    // 1. Delete previously incorrectly inserted Peajes_Potencia
    await client.query("DELETE FROM \"RegulatedCost\" WHERE concept = 'Peajes_Potencia' OR concept = 'Cargos_Potencia'");
    console.log("Deleted old power rows.");
    
    // 2. Insert new records
    for (const d of records) {
        const id = 'pot_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        let validFrom, validTo;
        if (d.y === 2024) {
            validFrom = '2024-01-01';
            validTo = '2024-12-31';
        } else if (d.y === 2025) {
            validFrom = '2025-01-01';
            validTo = '2025-12-31';
        } else if (d.y === 2026) {
            validFrom = '2026-01-01';
            validTo = '2030-12-31';
        }
        
        await client.query(`
            INSERT INTO "RegulatedCost" (id, concept, tariff, "validFrom", "validTo", p1, p2, p3, p4, p5, p6, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        `, [id, d.c, d.t, validFrom, validTo, d.p[0], d.p[1], d.p[2], d.p[3], d.p[4], d.p[5]]);
    }
    
    console.log("Successfully inserted", records.length, "power records.");
    
    await client.end();
}

main().catch(console.error);
