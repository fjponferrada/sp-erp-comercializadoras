const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

const records = [
    // 2024 CARGOS
    { y: 2024, c: 'Cargos_Energia', t: '2.0TD', p: [0.043893, 0.008779, 0.002195, 0, 0, 0] },
    { y: 2024, c: 'Cargos_Energia', t: '3.0TD', p: [0.024469, 0.018118, 0.009788, 0.004894, 0.003137, 0.001958] },
    { y: 2024, c: 'Cargos_Energia', t: '6.1TD', p: [0.013305, 0.009856, 0.005322, 0.002661, 0.001706, 0.001064] },
    { y: 2024, c: 'Cargos_Energia', t: '6.2TD', p: [0.006243, 0.004624, 0.002497, 0.001249, 0.000800, 0.000499] },
    { y: 2024, c: 'Cargos_Energia', t: '6.3TD', p: [0.005117, 0.003791, 0.002047, 0.001023, 0.000656, 0.000409] },
    { y: 2024, c: 'Cargos_Energia', t: '6.4TD', p: [0.001944, 0.001440, 0.000778, 0.000389, 0.000249, 0.000156] },
    { y: 2024, c: 'Cargos_Energia', t: '3.0TDVE', p: [0.052004, 0.038506, 0.020802, 0.010401, 0.006667, 0.004161] },
    { y: 2024, c: 'Cargos_Energia', t: '6.1TDVE', p: [0.041886, 0.031028, 0.016755, 0.008377, 0.005371, 0.003350] },

    // 2024 PEAJES
    { y: 2024, c: 'Peajes_Energia', t: '2.0TD', p: [0.033081, 0.019184, 0.000557, 0, 0, 0] },
    { y: 2024, c: 'Peajes_Energia', t: '3.0TD', p: [0.023974, 0.012820, 0.007573, 0.005495, 0.000424, 0.000234] },
    { y: 2024, c: 'Peajes_Energia', t: '6.1TD', p: [0.021899, 0.011675, 0.007394, 0.005376, 0.000406, 0.000212] },
    { y: 2024, c: 'Peajes_Energia', t: '6.2TD', p: [0.011872, 0.006530, 0.003686, 0.002774, 0.000249, 0.000090] },
    { y: 2024, c: 'Peajes_Energia', t: '6.3TD', p: [0.010399, 0.005651, 0.003603, 0.002659, 0.000238, 0.000140] },
    { y: 2024, c: 'Peajes_Energia', t: '6.4TD', p: [0.008757, 0.004806, 0.003067, 0.002206, 0.000139, 0.000089] },
    { y: 2024, c: 'Peajes_Energia', t: '3.0TDVE', p: [0.090973, 0.048795, 0.028775, 0.020869, 0.001638, 0.000891] },
    { y: 2024, c: 'Peajes_Energia', t: '6.1TDVE', p: [0.149751, 0.079821, 0.050557, 0.036755, 0.002772, 0.001450] },

    // 2025 CARGOS
    { y: 2025, c: 'Cargos_Energia', t: '2.0TD', p: [0.058305, 0.011661, 0.002915, 0, 0, 0] },
    { y: 2025, c: 'Cargos_Energia', t: '3.0TD', p: [0.032503, 0.024066, 0.013001, 0.006501, 0.004167, 0.002600] },
    { y: 2025, c: 'Cargos_Energia', t: '6.1TD', p: [0.017674, 0.013092, 0.007069, 0.003535, 0.002266, 0.001414] },
    { y: 2025, c: 'Cargos_Energia', t: '6.2TD', p: [0.008293, 0.006142, 0.003317, 0.001659, 0.001063, 0.000663] },
    { y: 2025, c: 'Cargos_Energia', t: '6.3TD', p: [0.006798, 0.005035, 0.002719, 0.001360, 0.000871, 0.000544] },
    { y: 2025, c: 'Cargos_Energia', t: '6.4TD', p: [0.002582, 0.001913, 0.001033, 0.000516, 0.000331, 0.000207] },
    { y: 2025, c: 'Cargos_Energia', t: '3.0TDVE', p: [0.069080, 0.051148, 0.027631, 0.013817, 0.008856, 0.005526] },
    { y: 2025, c: 'Cargos_Energia', t: '6.1TDVE', p: [0.055640, 0.041215, 0.022254, 0.011129, 0.007134, 0.004451] },

    // 2025 PEAJES
    { y: 2025, c: 'Peajes_Energia', t: '2.0TD', p: [0.034234, 0.016540, 0.000079, 0, 0, 0] },
    { y: 2025, c: 'Peajes_Energia', t: '3.0TD', p: [0.028528, 0.012343, 0.004673, 0.002682, 0.000119, 0.000031] },
    { y: 2025, c: 'Peajes_Energia', t: '6.1TD', p: [0.027104, 0.011894, 0.004726, 0.002739, 0.000122, 0.000029] },
    { y: 2025, c: 'Peajes_Energia', t: '6.2TD', p: [0.014770, 0.006840, 0.002279, 0.001219, 0.000063, 0.000020] },
    { y: 2025, c: 'Peajes_Energia', t: '6.3TD', p: [0.012294, 0.005470, 0.001931, 0.001063, 0.000055, 0.000015] },
    { y: 2025, c: 'Peajes_Energia', t: '6.4TD', p: [0.007944, 0.003569, 0.001288, 0.000681, 0.000036, 0.000004] },
    { y: 2025, c: 'Peajes_Energia', t: '3.0TDVE', p: [0.112704, 0.048870, 0.018713, 0.010844, 0.000474, 0.000130] },
    { y: 2025, c: 'Peajes_Energia', t: '6.1TDVE', p: [0.162917, 0.071484, 0.028390, 0.016448, 0.000733, 0.000174] }
];

async function main() {
    await client.connect();
    
    // Insert new records
    for (const d of records) {
        const id = 'ener_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        // Ensure tariff format is clean (6.3 TD -> 6.3TD to match system)
        const tariff = d.t.replace(' ', '');
        
        let validFrom, validTo;
        if (d.y === 2024) {
            validFrom = '2024-01-01'; // Used 01/01/24 even for cargos to prevent holes for Jan contracts
            validTo = '2024-12-31';
        } else if (d.y === 2025) {
            validFrom = '2025-01-01';
            validTo = '2025-12-31';
        }
        
        await client.query(`
            INSERT INTO "RegulatedCost" (id, concept, tariff, "validFrom", "validTo", p1, p2, p3, p4, p5, p6, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        `, [id, d.c, tariff, validFrom, validTo, d.p[0], d.p[1], d.p[2], d.p[3], d.p[4], d.p[5]]);
    }
    
    console.log("Successfully inserted", records.length, "energy records.");
    
    await client.end();
}

main().catch(console.error);
